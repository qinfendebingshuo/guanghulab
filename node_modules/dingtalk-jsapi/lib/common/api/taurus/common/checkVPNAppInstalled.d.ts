export declare const apiName = "taurus.common.checkVPNAppInstalled";
/**
 * 用于检查 miniConnectPro 软件是否安装 返回结果定义
 * @apiName taurus.common.checkVPNAppInstalled
 */
export interface ITaurusCommonCheckVPNAppInstalledResult {
    isInstalled: boolean;
}
/**
 * 用于检查 miniConnectPro 软件是否安装
 * @apiName taurus.common.checkVPNAppInstalled
 * @supportVersion ios: 1.6.0 android: 1.6.0
 */
export declare function checkVPNAppInstalled$(): Promise<ITaurusCommonCheckVPNAppInstalledResult>;
export default checkVPNAppInstalled$;
