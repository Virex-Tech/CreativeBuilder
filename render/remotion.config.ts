import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);
// One Chrome tab per core; the render service is expected to own its machine.
Config.setConcurrency(null);
