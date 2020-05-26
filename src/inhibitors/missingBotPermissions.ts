import { Inhibitor, KlasaMessage, Command } from 'klasa';
import { Permissions } from '@klasa/core';
import { toTitleCase } from '@klasa/utils';
import { ChannelType } from '@klasa/dapi-types';

type Key = keyof typeof Permissions.FLAGS;

export default class extends Inhibitor {

	private readonly impliedPermissions = new Permissions(515136).freeze();
	// VIEW_CHANNEL, SEND_MESSAGES, SEND_TTS_MESSAGES, EMBED_LINKS, ATTACH_FILES,
	// READ_MESSAGE_HISTORY, MENTION_EVERYONE, USE_EXTERNAL_EMOJIS, ADD_REACTIONS

	private readonly friendlyPerms = Object.keys(Permissions.FLAGS).reduce((obj, key) => {
		Reflect.set(obj, key, toTitleCase(key.split('_').join(' ')));
		return obj;
	}, {}) as Record<Key, string>;

	public run(message: KlasaMessage, command: Command): void {
		const missing = message.channel.type === ChannelType.GuildText ?
			// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
			message.guild!.me?.permissionsIn(message.channel).missing(command.requiredPermissions, false) ?? [] :
			this.impliedPermissions.missing(command.requiredPermissions, false);

		if (missing.length) throw message.language.get('INHIBITOR_MISSING_BOT_PERMS', missing.map(key => this.friendlyPerms[key as Key]).join(', '));
	}

}
