export type RootStackParamList = {
  Main: undefined;
  Login: undefined;
  Register: undefined;
  CompetitionDetail: { id: string };
  Arena: { id: string };
  Admin: undefined;
  AdminCompetitions: undefined;
  AdminEmail: undefined;
  AdminEmailEditor: { type: string };
  CreateCompetition: undefined;
  EditCompetition: { id: string };
  PvPList: undefined;
  PvPNew: undefined;
  PvPDetail: { id: string };
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
