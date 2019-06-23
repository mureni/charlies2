import { Brain } from "./brain";
import { log } from "./log";
import { Modifications, ProcessResults, processMessage, cleanMessage } from "./messageProcessor";
import { Trigger, Triggers, TriggerResult } from "./triggerProcessor";
import { getDisplayName, interpolateUsers, getEndearment } from "./user";
import { Message } from "discord.js";

export { Message, Brain, log, Modifications, ProcessResults, processMessage, cleanMessage, Trigger, Triggers, TriggerResult, getDisplayName, interpolateUsers, getEndearment };