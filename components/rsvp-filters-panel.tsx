'use client';

import { Button } from '@/components/ui/button';

export type SideFilter = 'groom' | 'bride';
export type RelationshipTagFilter = 'classmate' | 'colleague' | 'friend';
export type BinaryFilter = 'yes' | 'no';

type RsvpFiltersPanelProps = {
  selectedSides: SideFilter[];
  selectedRelationshipTags: RelationshipTagFilter[];
  selectedVegetarianStatus: BinaryFilter[];
  selectedAttendingStatus: BinaryFilter[];
  selectedPaperInvitationStatus: BinaryFilter[];
  onToggleSide: (value: SideFilter) => void;
  onToggleRelationshipTag: (value: RelationshipTagFilter) => void;
  onToggleVegetarianStatus: (value: BinaryFilter) => void;
  onToggleAttendingStatus: (value: BinaryFilter) => void;
  onTogglePaperInvitationStatus: (value: BinaryFilter) => void;
  onClearFilters: () => void;
  visibleGroups?: {
    side?: boolean;
    vegetarian?: boolean;
    attending?: boolean;
    relationshipTag?: boolean;
    paperInvitation?: boolean;
  };
};

export function RsvpFiltersPanel({
  selectedSides,
  selectedRelationshipTags,
  selectedVegetarianStatus,
  selectedAttendingStatus,
  selectedPaperInvitationStatus,
  onToggleSide,
  onToggleRelationshipTag,
  onToggleVegetarianStatus,
  onToggleAttendingStatus,
  onTogglePaperInvitationStatus,
  onClearFilters,
  visibleGroups,
}: RsvpFiltersPanelProps) {
  const showGroup = {
    side: visibleGroups?.side ?? true,
    vegetarian: visibleGroups?.vegetarian ?? true,
    attending: visibleGroups?.attending ?? true,
    relationshipTag: visibleGroups?.relationshipTag ?? true,
    paperInvitation: visibleGroups?.paperInvitation ?? true,
  };

  return (
    <div className='space-y-3 rounded-3xl border border-rose-100 bg-rose-50/40 p-4 text-sm'>
      <div className='flex items-center justify-between gap-2'>
        <p className='font-semibold text-stone-700'>篩選條件</p>
        <Button
          type='button'
          onClick={onClearFilters}
          variant='outline'
          size='sm'
          className='ml-auto h-auto rounded-full px-2.5 py-1 text-[11px]'
        >
          清除篩選
        </Button>
      </div>
      <div className='flex flex-wrap items-center gap-x-14 gap-y-2'>
        {showGroup.side ? (
          <FilterGroup
            label='男方 / 女方'
            options={[
              { value: 'groom', label: '男方' },
              { value: 'bride', label: '女方' },
            ]}
            selectedValues={selectedSides}
            onToggle={onToggleSide}
          />
        ) : null}

        {showGroup.vegetarian ? (
          <FilterGroup
            label='吃素'
            options={[
              { value: 'yes', label: '素食' },
              { value: 'no', label: '不素' },
            ]}
            selectedValues={selectedVegetarianStatus}
            onToggle={onToggleVegetarianStatus}
          />
        ) : null}

        {showGroup.attending ? (
          <FilterGroup
            label='是否參加'
            options={[
              { value: 'yes', label: '參加' },
              { value: 'no', label: '不參加' },
            ]}
            selectedValues={selectedAttendingStatus}
            onToggle={onToggleAttendingStatus}
          />
        ) : null}

        {showGroup.relationshipTag ? (
          <FilterGroup
            label='關係標籤'
            options={[
              { value: 'classmate', label: '同學' },
              { value: 'colleague', label: '同事' },
              { value: 'friend', label: '朋友' },
            ]}
            selectedValues={selectedRelationshipTags}
            onToggle={onToggleRelationshipTag}
          />
        ) : null}

        {showGroup.paperInvitation ? (
          <FilterGroup
            label='紙本喜帖'
            options={[
              { value: 'yes', label: '需要' },
              { value: 'no', label: '不需要' },
            ]}
            selectedValues={selectedPaperInvitationStatus}
            onToggle={onTogglePaperInvitationStatus}
          />
        ) : null}
      </div>
    </div>
  );
}

function FilterGroup<T extends string>({
  label,
  options,
  selectedValues,
  onToggle,
}: {
  label: string;
  options: Array<{ value: T; label: string }>;
  selectedValues: T[];
  onToggle: (value: T) => void;
}) {
  return (
    <div className='flex flex-wrap items-center gap-x-2 gap-y-1.5'>
      <p className='min-w-fit text-xs text-stone-600'>{label}</p>
      {options.map((option) => (
        <label
          key={option.value}
          className='flex cursor-pointer items-center gap-2 rounded-xl border border-rose-200 bg-white px-3 py-1.5 text-xs text-stone-700 transition hover:border-rose-300'
        >
          <input
            type='checkbox'
            checked={selectedValues.includes(option.value)}
            onChange={() => onToggle(option.value)}
            className='h-3 w-3 appearance-none rounded-full border border-rose-300 bg-white focus:ring-sky-400 checked:border-sky-500 checked:bg-[radial-gradient(circle,_#0ea5e9_38%,_transparent_40%)]'
          />
          <span>{option.label}</span>
        </label>
      ))}
    </div>
  );
}
