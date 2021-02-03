import { Brain } from "./brain";
import { log } from "./log";
import { ModificationType, ProcessResults, processMessage, cleanMessage } from "./messageProcessor";
import { Trigger, Triggers, TriggerResult } from "./triggerProcessor";
import { Conversation, KnownUsers, getDisplayName, interpolateUsers, getEndearment } from "./user";
import { Message } from "discord.js";

export { Conversation, KnownUsers, Message, Brain, log, ModificationType, ProcessResults, processMessage, cleanMessage, Trigger, Triggers, TriggerResult, getDisplayName, interpolateUsers, getEndearment };