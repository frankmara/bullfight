export type RootStackParamList = {
  Main: undefined;
  Login: undefined;
  Register: undefined;
  CompetitionDetail: { id: string };
  Arena: { id: string };
  Admin: undefined;
  AdminCompetitions: undefined;
  CreateCompetition: undefined;
  EditCompetition: { id: string };
};

export type MainTabParamList = {
  HomeTab: undefined;
  DashboardTab: undefined;
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
