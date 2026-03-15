import { ICommonAPIParams } from '../../../constant/types';
/**
 * 是否开启无障碍模式 请求参数定义
 * @apiName device.screen.isScreenReaderEnabled
 */
export interface IDeviceScreenIsScreenReaderEnabledParams extends ICommonAPIParams {
}
/**
 * 是否开启无障碍模式 返回结果定义
 * @apiName device.screen.isScreenReaderEnabled
 */
export interface IDeviceScreenIsScreenReaderEnabledResult {
    screenReaderEnabled: boolean;
}
/**
 * 是否开启无障碍模式
 * @apiName device.screen.isScreenReaderEnabled
 */
export declare function isScreenReaderEnabled$(params: IDeviceScreenIsScreenReaderEnabledParams): Promise<IDeviceScreenIsScreenReaderEnabledResult>;
export default isScreenReaderEnabled$;
