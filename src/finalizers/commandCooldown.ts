import { Finalizer, Command } from 'klasa';
import { RateLimitManager, RateLimit } from '@klasa/ratelimits';

import type { Message } from '@klasa/core';

export default class extends Finalizer {

	public cooldowns = new WeakMap();

	public run(message: Message, command: Command): void {
		if (command.cooldown <= 0 || this.client.owners.has(message.author)) return;

		try {
			this.getCooldown(message, command).drip();
		} catch (err) {
			this.client.emit('error', `${message.author.username}[${message.author.id}] has exceeded the RateLimit for ${message.command}`);
		}
	}

	public getCooldown(message: Message, command: Command): RateLimit {
		let cooldownManager = this.cooldowns.get(command);
		if (!cooldownManager) {
			cooldownManager = new RateLimitManager(command.bucket, command.cooldown * 1000);
			this.cooldowns.set(command, cooldownManager);
		}
		return cooldownManager.acquire(message.guild ? Reflect.get(message, command.cooldownLevel).id : message.author.id);
	}

}
