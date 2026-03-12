import { ICommonAPIParams } from '../../constant/types';
/**
 * 设置屏幕亮度 请求参数定义
 * @apiName setScreenBrightness
 */
export interface IUnionSetScreenBrightnessParams extends ICommonAPIParams {
    brightness: number;
}
/**
 * 设置屏幕亮度 返回结果定义
 * @apiName setScreenBrightness
 */
export interface IUnionSetScreenBrightnessResult {
}
/**
 * 设置屏幕亮度
 * @apiName setScreenBrightness
 */
export declare function setScreenBrightness$(params: IUnionSetScreenBrightnessParams): Promise<IUnionSetScreenBrightnessResult>;
export default setScreenBrightness$;
