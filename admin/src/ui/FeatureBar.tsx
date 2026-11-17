/* ---------- Feature publishing bar ----------
   On each feature's page (Layout, Campaigns, Emergency alerts, Quick links, Featured cards, Audience segments),
   a slim bar moves several of that feature's items at once:
   - Deploy drafts to demo        (saved draft → new version on demo)
   - Publish demo to production   (the version on demo → production)
   - Publish drafts directly      (saved draft → new version on demo and production, skipping the demo check)
   Each batch opens a list of the items it can move, all ticked; untick any to leave them out.
   Only what the signed-in role may do is offered; the rest is named in a note. */
/* EXTRA_GLYPHS: edit_note science public rocket_launch bolt view_agenda campaign warning apps library_books groups description info */
import { useState } from 'react';
import { Btn, Icon } from './kit';
import { confirmDialog, toast } from './overlays';
import { ConfigService, CONFIG_TYPES, DB } from '../services/services';
import { Session } from '../app/session';
import { Router, Unsaved, useDb } from '../app/router';
import { canAct, type Action } from '../app/permissions';
import { fmtDateTime, plural } from '../app/util';
import type { ConfigRecord, ConfigType } from '../app/types';

const FB_ICONS: Partial<Record<ConfigType, string>> = { homeLayout: 'view_agenda', campaign: 'campaign', alert: 'warning', quickLink: 'apps', featuredCard: 'library_books', segment: 'groups' };
type Kind = 'demo' | 'prod' | 'direct';
const T = {
  demo: { title: 'Deploy drafts to demo', verb: 'Deploy', lede: 'Each saved draft becomes a new version on demo, for checking on test devices. Production doesn’t change.', confirm: 'Deploy to demo', busy: 'Deploying', done: 'to demo' },
  prod: { title: 'Publish demo to production', verb: 'Publish', lede: 'Each item publishes the version that is on demo now. What patients see in the app changes.', confirm: 'Publish to production', busy: 'Publishing', done: 'to production' },
  direct: { title: 'Publish drafts directly to production', verb: 'Publish', lede: 'Each saved draft goes straight to production as a new version, skipping the check on demo. Use it for urgent or trivial changes.', confirm: 'Publish directly', busy: 'Publishing', done: 'directly to production' }
};

/* The tick list inside the confirm dialog; ticked ids are kept in a Set the caller reads */
function PickList({ list, kind, picked }: { list: ConfigRecord[]; kind: Kind; picked: Set<string> }) {
  const [, bump] = useState(0);
  return (
    <ul className="hub-confirm fb-pick">{list.map(r => (
      <li key={r.id}><label className="checkbox fb-row" htmlFor={`pick-${r.id}`}>
        <input type="checkbox" id={`pick-${r.id}`} data-pick={r.id} checked={picked.has(r.id)} onChange={e => { e.target.checked ? picked.add(r.id) : picked.delete(r.id); bump(n => n + 1); }} />
        <Icon name={FB_ICONS[r.type] || 'description'} size={20} /><span><b>{r.name}</b> <span className="muted">{kind === 'prod' ? `v${r.demo} on demo` : `draft saved ${fmtDateTime(r.draft!.updatedAt)}`}</span></span></label></li>))}
    </ul>
  );
}

export function FeatureBar({ types }: { types: ConfigType[] }) {
  useDb();
  const [busy, setBusy] = useState<Kind | null>(null);
  const role = Session.role()!;
  const recs = types.flatMap(t => ConfigService.peekAll(t));
  const st = { drafts: recs.filter(r => r.draft), demo: recs.filter(r => r.demo && r.demo !== r.production), live: recs.filter(r => r.production) };
  const may = (r: ConfigRecord, a: Action) => canAct(role, CONFIG_TYPES[r.type].area, a);
  const lists: Record<Kind, ConfigRecord[]> = { demo: st.drafts.filter(r => may(r, 'deployDemo')), prod: st.demo.filter(r => may(r, 'publish')), direct: st.drafts.filter(r => may(r, 'publish')) };
  const go = async (kind: Kind) => {
    if (Unsaved.on) { toast('Save or discard your changes first. Batches use saved drafts only.', { kind: 'error', ms: 7000 }); return; }
    const t = T[kind], list = lists[kind];
    const needComment = kind !== 'demo' && !!DB.db.settings.requirePublishComment;
    const picked = new Set(list.map(r => r.id));
    const c = await confirmDialog({
      title: `${t.title}?`, wide: true,
      body: <>{kind === 'direct' && <div className="warn-box"><Icon name="bolt" size={20} /><p>This skips demo: the drafts aren’t checked on test devices before patients see them.</p></div>}
        <p>{t.lede} Untick any you want to leave out.</p><PickList list={list} kind={kind} picked={picked} /></>,
      confirmLabel: t.confirm, variant: kind === 'direct' ? 'danger' : 'primary',
      comment: { label: 'Comment', required: needComment, hint: needComment ? 'Required by Administrative settings. Added to each item’s history.' : 'Optional. Added to each item’s history.' }
    });
    if (!c.ok) return;
    const chosen = list.filter(r => picked.has(r.id));
    if (!chosen.length) { toast('Nothing was selected, so nothing changed.'); return; }
    setBusy(kind);
    let done = 0; const failed: string[] = [];
    for (const r of chosen) {
      try { await (kind === 'demo' ? ConfigService.deployToDemo(r.id, c.comment) : kind === 'prod' ? ConfigService.publish(r.id, c.comment) : ConfigService.publishDirect(r.id, c.comment)); done++; }
      catch (err) { failed.push(`${r.name}: ${(err as Error).message}`); }
    }
    setBusy(null);
    Router.clearGuard();
    toast(`${t.verb === 'Deploy' ? 'Deployed' : 'Published'} ${plural(done, 'item')} ${t.done}.${failed.length ? ` ${failed.length} didn’t: ${failed.join('; ')}` : ''}`, { kind: failed.length ? 'error' : 'success', ms: failed.length ? 9000 : 5000 });
    Router.refresh();
    setTimeout(() => document.getElementById('hub-pub-h')?.focus(), 60);
  };
  const nd = st.drafts.length - lists.demo.length, np = st.demo.length - lists.prod.length;
  return (
    /* Stage counts stay as data for scripts and tests; they aren't shown */
    <section className="card hub-pub" aria-labelledby="hub-pub-h" id="hub-pub" data-draft={st.drafts.length} data-demo={st.demo.length} data-prod={st.live.length}>
      <div className="hub-bar">
        <h2 id="hub-pub-h" className="hub-bar-h" tabIndex={-1}>Publishing</h2>
        <div className="hub-acts">
          <Btn label={lists.demo.length ? `Deploy ${plural(lists.demo.length, 'draft')} to demo` : 'Deploy to demo'} icon="science" variant="secondary" size="sm" data-hub="demo" disabled={!lists.demo.length} busy={busy === 'demo'} busyLabel={T.demo.busy} onClick={() => go('demo')} />
          <Btn label={lists.prod.length ? `Publish ${lists.prod.length} to production` : 'Publish to production'} icon="rocket_launch" variant="primary" size="sm" data-hub="prod" disabled={!lists.prod.length} busy={busy === 'prod'} busyLabel={T.prod.busy} onClick={() => go('prod')} />
          {role !== 'marketing' && <Btn label={lists.direct.length ? `Publish ${plural(lists.direct.length, 'draft')} directly` : 'Publish drafts directly'} icon="bolt" variant="secondary" size="sm" data-hub="direct" disabled={!lists.direct.length} busy={busy === 'direct'} busyLabel={T.direct.busy} onClick={() => go('direct')} />}
        </div>
      </div>
      {(nd > 0 || np > 0) && <p className="role-note"><Icon name="info" size={20} /><span>{[
        nd > 0 ? `${plural(nd, 'draft')} need${nd === 1 ? 's' : ''} a role that can deploy it` : '',
        np > 0 ? `${plural(np, 'item')} on demo need${np === 1 ? 's' : ''} an Admin or Super Admin to publish` : ''].filter(Boolean).join('. ')}.</span></p>}
    </section>
  );
}
