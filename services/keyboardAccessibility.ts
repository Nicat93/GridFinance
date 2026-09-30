export interface ExpandableRowKeyboardEvent {
    key: string;
    target: unknown;
    currentTarget: unknown;
    preventDefault: () => void;
    stopPropagation: () => void;
}

export const handleExpandableRowKeyboardActivation = (
    event: ExpandableRowKeyboardEvent,
    activate: () => void,
): boolean => {
    if (event.target !== event.currentTarget || (event.key !== 'Enter' && event.key !== ' ')) return false;
    event.preventDefault();
    event.stopPropagation();
    activate();
    return true;
};
