export interface WorkflowStep {
  id: string;
  label: string;
  description: string;
  route: string;
  icon: string;
  completed: boolean;
  active: boolean;
  accessible: boolean;
}
