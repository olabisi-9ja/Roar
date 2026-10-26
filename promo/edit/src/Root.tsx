import { Composition } from "remotion";
import { Ad, AD_FRAMES } from "./Ad";

export const Root = () => (
  <Composition id="Ad" component={Ad} durationInFrames={AD_FRAMES} fps={30} width={1920} height={1080} />
);
