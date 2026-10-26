import { AudioPlayer } from './audio-player';
import { asOptionalString, commonProps, type A2uiRenderers } from './a2ui-context';
import { Video } from './video';

export const MEDIA_RENDERERS: A2uiRenderers = {
  Video: (ctx) => {
    const url = ctx.mediaUrl(ctx.props.url);
    const poster = ctx.props.posterUrl === undefined ? '' : ctx.mediaUrl(ctx.props.posterUrl);
    return url === '' ? null : <Video {...commonProps(ctx)} url={url} posterUrl={poster === '' ? undefined : poster} />;
  },
  AudioPlayer: (ctx) => {
    const url = ctx.mediaUrl(ctx.props.url);
    return url === '' ? null : <AudioPlayer {...commonProps(ctx)} url={url} description={asOptionalString(ctx.props.description)} />;
  },
};
