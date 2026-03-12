export declare const apiName = "internal.alpha.connectSecurityWiFi";
/**
 * 连接指定的WiFi网络 请求参数定义
 * @apiName internal.alpha.connectSecurityWiFi
 */
export interface IInternalAlphaConnectSecurityWiFiParams {
    /** WiFi名称 */
    ssid: string;
    /** WiFi密码 */
    password: string;
}
/**
 * 连接指定的WiFi网络 返回结果定义
 * @apiName internal.alpha.connectSecurityWiFi
 */
export interface IInternalAlphaConnectSecurityWiFiResult {
    /** 连接类型 */
    connectType: string;
}
/**
 * 连接指定的WiFi网络
 * @apiName internal.alpha.connectSecurityWiFi
 * @supportVersion ios: 4.3.7 android: 4.3.7
 */
export declare function connectSecurityWiFi$(params: IInternalAlphaConnectSecurityWiFiParams): Promise<IInternalAlphaConnectSecurityWiFiResult>;
export default connectSecurityWiFi$;
