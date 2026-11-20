UPDATE "TaskRun" 
SET status = 'FAILED', 
    error = 'InputMappingResolutionError: Target input deliveryTier failed resolving path [result, tier]: property result does not exist on source output Reserve Warehouse Stock', 
    "completedAt" = NOW() 
WHERE id = 'b020e8a0-1671-415a-8bd1-761f0dc185b7';

UPDATE "WorkflowRun" 
SET status = 'FAILED', 
    "completedAt" = NOW() 
WHERE id = '16027014-0e3c-4565-8192-3bf5a6a31eaa';

