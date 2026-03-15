import { ICommonAPIParams } from '../../../constant/types';
/**
 * 获取屏幕亮度 请求参数定义
 * @apiName device.screen.getScreenBrightness
 */
export interface IDeviceScreenGetScreenBrightnessParams extends ICommonAPIParams {
}
/**
 * 获取屏幕亮度 返回结果定义
 * @apiName device.screen.getScreenBrightness
 */
export interface IDeviceScreenGetScreenBrightnessResult {
    brightness: number;
}
/**
 * 获取屏幕亮度
 * @apiName device.screen.getScreenBrightness
 */
export declare function getScreenBrightness$(params: IDeviceScreenGetScreenBrightnessParams): Promise<IDeviceScreenGetScreenBrightnessResult>;
export default getScreenBrightness$;
