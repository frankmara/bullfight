export type RootStackParamList = {
  Main: undefined;
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
  ResetPassword: { token: string };
  CompetitionDetail: { id: string };
  Arena: { competitionId: string };
  ArenaMode: undefined;
  Admin: undefined;
  AdminCompetitions: undefined;
  AdminEmail: undefined;
  AdminEmailEditor: { type: string };
  CreateCompetition: undefined;
  EditCompetition: { id: string };
  PvPList: undefined;
  PvPNew: undefined;
  PvPDetail: { id: string };
  PaymentSuccess: { type?: string; id?: string; session_id?: string };
  PaymentCancel: { type?: string; id?: string };
  Wallet: undefined;
};

export type MainTabParamList = {
  HomeTab: undefined;
  DashboardTab: undefined;
  PvPTab: undefined;
  ProfileTab: undefined;
};

export type HomeStackParamList = {
  Landing: undefined;
};

export type DashboardStackParamList = {
  Dashboard: undefined;
};

export type ProfileStackParamList = {
  Profile: undefined;
};
