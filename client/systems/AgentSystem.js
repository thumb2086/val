// client/systems/AgentSystem.js

const AGENTS = {
  'jett': {
    name: 'Jett',
    abilities: {
      q: { name: 'Cloudburst', type: 'smoke' },
      e: { name: 'Tailwind', type: 'dash' },
      x: { name: 'Blade Storm', type: 'ultimate' },
    }
  },
  'sage': {
    name: 'Sage',
    abilities: {
      q: { name: 'Slow Orb', type: 'crowd-control' },
      e: { name: 'Healing Orb', type: 'heal' },
      x: { name: 'Resurrection', type: 'ultimate' },
    }
  }
};

export default class AgentSystem {
  constructor() {
    this.selectedAgent = null;
    this.agents = AGENTS;
  }

  selectAgent(agentId) {
    if (this.agents[agentId]) {
      this.selectedAgent = this.agents[agentId];
      console.log(`Agent selected: ${this.selectedAgent.name}`);
    } else {
      console.error(`Agent with ID ${agentId} not found.`);
    }
  }

  useAbility(abilityKey) {
    if (!this.selectedAgent) {
      console.warn('No agent selected.');
      return;
    }

    const ability = this.selectedAgent.abilities[abilityKey];
    if (ability) {
      console.log(`Using ability: ${ability.name}`);
      // TODO: Implement ability logic
    } else {
      console.warn(`Ability with key ${abilityKey} not found for agent ${this.selectedAgent.name}.`);
    }
  }
}