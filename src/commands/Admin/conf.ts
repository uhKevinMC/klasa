import { Argument, Command, CommandStore, GatewayStorage, Schema, SchemaEntry, SchemaFolder, SettingsFolder } from 'klasa';
import { toTitleCase, codeBlock } from '@klasa/utils';
import { ChannelType } from '@klasa/dapi-types';

import type { Message, Guild } from '@klasa/core';

export default class extends Command {

	private readonly configurableSchemaKeys = new Map<string, Schema | SchemaEntry>();

	public constructor(store: CommandStore, directory: string, files: readonly string[]) {
		super(store, directory, files, {
			runIn: [ChannelType.GuildText],
			permissionLevel: 6,
			guarded: true,
			subcommands: true,
			description: language => language.get('COMMAND_CONF_SERVER_DESCRIPTION'),
			usage: '<set|remove|reset|show:default> (key:key) (value:value)',
			usageDelim: ' '
		});

		this
			.createCustomResolver('key', (arg, _possible, message, [action]) => {
				if (action === 'show' || arg) return arg || '';
				throw message.language.get('COMMAND_CONF_NOKEY');
			})
			.createCustomResolver('value', (arg, possible, message, [action]) => {
				if (!['set', 'remove'].includes(action)) return null;
				if (arg) return (this.client.arguments.get('...string') as Argument).run(arg, possible, message);
				throw message.language.get('COMMAND_CONF_NOVALUE');
			});
	}

	public show(message: Message, [key]: [string]): Promise<Message[]> {
		const schemaOrEntry = this.configurableSchemaKeys.get(key);
		if (typeof schemaOrEntry === 'undefined') throw message.language.get('COMMAND_CONF_GET_NOEXT', key);

		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
		const value = key ? message.guild!.settings.get(key) : message.guild!.settings;
		if (SchemaEntry.is(schemaOrEntry)) {
			return message.sendLocale('COMMAND_CONF_GET', [key, this.displayEntry(schemaOrEntry, value, message.guild as Guild)]);
		}

		return message.sendLocale('COMMAND_CONF_SERVER', [
			key ? `: ${key.split('.').map(toTitleCase).join('/')}` : '',
			codeBlock('asciidoc', this.displayFolder(value as SettingsFolder))
		]);
	}

	public async set(message: Message, [key, valueToSet]: [string, string]): Promise<Message[]> {
		try {
			// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
			const [update] = await message.guild!.settings.update(key, valueToSet, { onlyConfigurable: true, arrayAction: 'add' });
			return message.sendLocale('COMMAND_CONF_UPDATED', [key, this.displayEntry(update.entry, update.next, message.guild as Guild)]);
		} catch (error) {
			throw String(error);
		}
	}

	public async remove(message: Message, [key, valueToRemove]: [string, string]): Promise<Message[]> {
		try {
			// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
			const [update] = await message.guild!.settings.update(key, valueToRemove, { onlyConfigurable: true, arrayAction: 'remove' });
			return message.sendLocale('COMMAND_CONF_UPDATED', [key, this.displayEntry(update.entry, update.next, message.guild as Guild)]);
		} catch (error) {
			throw String(error);
		}
	}

	public async reset(message: Message, [key]: [string]): Promise<Message[]> {
		try {
			// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
			const [update] = await message.guild!.settings.reset(key);
			return message.sendLocale('COMMAND_CONF_RESET', [key, this.displayEntry(update.entry, update.next, message.guild as Guild)]);
		} catch (error) {
			throw String(error);
		}
	}

	public init(): void {
		const { schema } = this.client.gateways.get('guilds') as GatewayStorage;
		if (this.initFolderConfigurableRecursive(schema)) this.configurableSchemaKeys.set(schema.path, schema);
	}

	private displayFolder(settings: SettingsFolder): string {
		const array = [];
		const folders = [];
		const sections = new Map<string, string[]>();
		let longest = 0;
		for (const [key, value] of settings.schema.entries()) {
			if (!this.configurableSchemaKeys.has(value.path)) continue;

			if (value.type === 'Folder') {
				folders.push(`// ${key}`);
			} else {
				const values = sections.get(value.type) || [];
				values.push(key);

				if (key.length > longest) longest = key.length;
				if (values.length === 1) sections.set(value.type, values);
			}
		}
		if (folders.length) array.push('= Folders =', ...folders.sort(), '');
		if (sections.size) {
			for (const keyType of [...sections.keys()].sort()) {
				array.push(`= ${toTitleCase(keyType)}s =`,
					// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
					...sections.get(keyType)!.sort().map(key =>
						// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
						`${key.padEnd(longest)} :: ${this.displayEntry(settings.schema.get(key) as SchemaEntry, settings.get(key), settings.base!.target as Guild)}`),
					'');
			}
		}
		return array.join('\n');
	}

	private displayEntry(entry: SchemaEntry, value: unknown, guild: Guild): string {
		return entry.array ?
			this.displayEntryMultiple(entry, value as readonly unknown[], guild) :
			this.displayEntrySingle(entry, value, guild);
	}

	private displayEntrySingle(entry: SchemaEntry, value: unknown, guild: Guild): string {
		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
		return entry.serializer!.stringify(value, guild);
	}

	private displayEntryMultiple(entry: SchemaEntry, values: readonly unknown[], guild: Guild): string {
		return values.length === 0 ?
			'None' :
			`[ ${values.map(value => this.displayEntrySingle(entry, value, guild)).join(' | ')} ]`;
	}

	private initFolderConfigurableRecursive(folder: Schema): boolean {
		const previousConfigurableCount = this.configurableSchemaKeys.size;
		for (const value of folder.values()) {
			if (SchemaFolder.is(value)) {
				if (this.initFolderConfigurableRecursive(value)) this.configurableSchemaKeys.set(value.path, value);
			} else if (value.configurable) {
				this.configurableSchemaKeys.set(value.path, value);
			}
		}

		return previousConfigurableCount !== this.configurableSchemaKeys.size;
	}

}
