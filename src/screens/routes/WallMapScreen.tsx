import React from "react";
import { SprayWallScreen } from "@/screens/SprayWall/SprayWallScreen";

interface WallMapScreenProps {
  route: {
    params?: {
      wallId?: string;
    };
  };
  navigation: any;
}

const WallMapScreen: React.FC<WallMapScreenProps> = ({ route, navigation }) => {
  const sprayWallRoute = {
    params: route.params || {},
  };

  return <SprayWallScreen route={sprayWallRoute} navigation={navigation} />;
};

export default WallMapScreen;
