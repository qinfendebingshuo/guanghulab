export declare const apiName = "taurus.common.callPhone";
/**
 * 调用系统拨打电话 请求参数定义
 * @apiName taurus.common.callPhone
 */
export interface ITaurusCommonCallPhoneParams {
    phoneNum: string;
}
export interface ITaurusCommonCallPhoneResult {
}
/**
 * 调用系统拨打电话
 * @apiName taurus.common.callPhone
 * @supportVersion ios: 1.1.0 android: 1.1.0
 */
export declare function callPhone$(params: ITaurusCommonCallPhoneParams): Promise<ITaurusCommonCallPhoneResult>;
export default callPhone$;
