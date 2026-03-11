export declare const apiName = "taurus.common.checkVPNAppOnline";
/**
 * 用于检查 miniConnectPro VPN 是否在线 返回结果定义
 * @apiName taurus.common.checkVPNAppOnline
 */
export interface ITaurusCommonCheckVPNAppOnlineResult {
    isOnline: boolean;
}
/**
 * 用于检查 miniConnectPro VPN 是否在线
 * @apiName taurus.common.checkVPNAppOnline
 * @supportVersion ios: 1.6.0 android: 1.6.0
 */
export declare function checkVPNAppOnline$(): Promise<ITaurusCommonCheckVPNAppOnlineResult>;
export default checkVPNAppOnline$;
