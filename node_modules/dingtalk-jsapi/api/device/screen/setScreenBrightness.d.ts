import { ICommonAPIParams } from '../../../constant/types';
/**
 * 设置屏幕亮度 请求参数定义
 * @apiName device.screen.setScreenBrightness
 */
export interface IDeviceScreenSetScreenBrightnessParams extends ICommonAPIParams {
    brightness: number;
}
/**
 * 设置屏幕亮度 返回结果定义
 * @apiName device.screen.setScreenBrightness
 */
export interface IDeviceScreenSetScreenBrightnessResult {
}
/**
 * 设置屏幕亮度
 * @apiName device.screen.setScreenBrightness
 */
export declare function setScreenBrightness$(params: IDeviceScreenSetScreenBrightnessParams): Promise<IDeviceScreenSetScreenBrightnessResult>;
export default setScreenBrightness$;
