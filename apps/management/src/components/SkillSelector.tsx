import React, { useState } from 'react';

interface Skill {
  _id: string;
  name: string;
}

interface RequiredSkill {
  skillId?: string;
  skillName: string;
  isFixed?: boolean;
  alternatives?: Array<{
    skillId?: string;
    skillName: string;
  }>;
}

interface BonusSkill {
  skillId?: string;
  skillName: string;
  bonusValue: number;
}

interface SkillSelectorProps {
  type: 'required' | 'bonus';
  selectedSkills: RequiredSkill[] | BonusSkill[];
  onChange: (skills: RequiredSkill[] | BonusSkill[]) => void;
  availableSkills: Skill[];
}

export const SkillSelector: React.FC<SkillSelectorProps> = ({
  type,
  selectedSkills,
  onChange,
  availableSkills
}) => {
  const [newSkillId, setNewSkillId] = useState<string>('');

  const handleAddSkill = () => {
    if (!newSkillId) return;

    const skill = availableSkills.find(s => s._id === newSkillId);
    if (!skill) return;

    if (type === 'required') {
      const newSkill: RequiredSkill = {
        skillId: skill._id,
        skillName: skill.name,
        isFixed: false,
        alternatives: []
      };
      onChange([...selectedSkills as RequiredSkill[], newSkill]);
    } else {
      const newSkill: BonusSkill = {
        skillId: skill._id,
        skillName: skill.name,
        bonusValue: 10
      };
      onChange([...selectedSkills as BonusSkill[], newSkill]);
    }

    setNewSkillId('');
  };

  const handleRemoveSkill = (index: number) => {
    const updated = [...selectedSkills];
    updated.splice(index, 1);
    onChange(updated);
  };

  const handleToggleFixed = (index: number) => {
    if (type !== 'required') return;

    const updated = [...selectedSkills as RequiredSkill[]];
    updated[index] = {
      ...updated[index],
      isFixed: !updated[index].isFixed
    };
    onChange(updated);
  };

  const handleAddAlternative = (skillIndex: number) => {
    if (type !== 'required') return;

    const altSkillId = prompt('Enter alternative skill ID or select from list:');
    if (!altSkillId) return;

    const skill = availableSkills.find(s => s._id === altSkillId || s.name === altSkillId);
    if (!skill) {
      alert('Skill not found');
      return;
    }

    const updated = [...selectedSkills as RequiredSkill[]];
    const alternatives = updated[skillIndex].alternatives || [];
    alternatives.push({
      skillId: skill._id,
      skillName: skill.name
    });
    updated[skillIndex] = {
      ...updated[skillIndex],
      alternatives
    };
    onChange(updated);
  };

  const handleRemoveAlternative = (skillIndex: number, altIndex: number) => {
    if (type !== 'required') return;

    const updated = [...selectedSkills as RequiredSkill[]];
    const alternatives = [...(updated[skillIndex].alternatives || [])];
    alternatives.splice(altIndex, 1);
    updated[skillIndex] = {
      ...updated[skillIndex],
      alternatives
    };
    onChange(updated);
  };

  const handleBonusValueChange = (index: number, value: number) => {
    if (type !== 'bonus') return;

    const updated = [...selectedSkills as BonusSkill[]];
    updated[index] = {
      ...updated[index],
      bonusValue: value
    };
    onChange(updated);
  };

  // Filter out already selected skills
  const getAvailableSkillsForSelection = (): Skill[] => {
    const selectedIds = new Set(
      selectedSkills.map((s: RequiredSkill | BonusSkill) => s.skillId)
    );
    return availableSkills.filter(s => !selectedIds.has(s._id));
  };

  return (
    <div className="space-y-4">
      {/* Add new skill dropdown */}
      <div className="flex gap-2">
        <select
          value={newSkillId}
          onChange={(e) => setNewSkillId(e.target.value)}
          className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm"
        >
          <option value="">-- Select a skill to add --</option>
          {getAvailableSkillsForSelection().map(skill => (
            <option key={skill._id} value={skill._id}>
              {skill.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={handleAddSkill}
          disabled={!newSkillId}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 text-sm"
        >
          + Add
        </button>
      </div>

      {/* List of selected skills */}
      {selectedSkills.length === 0 ? (
        <p className="text-sm text-gray-500 italic">No skills added yet</p>
      ) : (
        <div className="space-y-3">
          {selectedSkills.map((skill: RequiredSkill | BonusSkill, index: number) => (
            <div
              key={index}
              className="border border-gray-300 rounded-md p-3 bg-gray-50"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3 flex-1">
                  <span className="font-medium text-gray-900">{skill.skillName}</span>

                  {type === 'required' && 'isFixed' in skill && (
                    <>
                      <label className="flex items-center gap-1 text-sm text-gray-600">
                        <input
                          type="checkbox"
                          checked={skill.isFixed || false}
                          onChange={() => handleToggleFixed(index)}
                          className="rounded"
                        />
                        Fixed
                      </label>
                      <button
                        type="button"
                        onClick={() => handleAddAlternative(index)}
                        className="text-xs text-blue-600 hover:text-blue-800"
                      >
                        + Add Alternative
                      </button>
                    </>
                  )}

                  {type === 'bonus' && 'bonusValue' in skill && (
                    <div className="flex items-center gap-2">
                      <label className="text-sm text-gray-600">Bonus:</label>
                      <input
                        type="number"
                        value={skill.bonusValue || 0}
                        onChange={(e) => handleBonusValueChange(index, parseInt(e.target.value) || 0)}
                        min="0"
                        max="100"
                        className="w-20 px-2 py-1 border border-gray-300 rounded text-sm"
                      />
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => handleRemoveSkill(index)}
                  className="px-3 py-1 bg-red-500 text-white rounded-md hover:bg-red-600 text-sm"
                >
                  Remove
                </button>
              </div>

              {/* Alternatives list (only for required skills) */}
              {type === 'required' && 'alternatives' in skill && skill.alternatives && skill.alternatives.length > 0 && (
                <div className="ml-6 mt-2 space-y-1">
                  <p className="text-xs text-gray-600 font-medium">Alternatives:</p>
                  {skill.alternatives.map((alt: { skillId?: string; skillName: string }, altIndex: number) => (
                    <div
                      key={altIndex}
                      className="flex items-center justify-between bg-white rounded px-2 py-1 text-sm"
                    >
                      <span className="text-gray-700">→ {alt.skillName}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveAlternative(index, altIndex)}
                        className="text-red-500 hover:text-red-700 text-xs"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
