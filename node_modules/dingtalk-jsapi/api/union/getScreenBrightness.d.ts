import { ICommonAPIParams } from '../../constant/types';
/**
 * 获取屏幕亮度 请求参数定义
 * @apiName getScreenBrightness
 */
export interface IUnionGetScreenBrightnessParams extends ICommonAPIParams {
}
/**
 * 获取屏幕亮度 返回结果定义
 * @apiName getScreenBrightness
 */
export interface IUnionGetScreenBrightnessResult {
    brightness: number;
}
/**
 * 获取屏幕亮度
 * @apiName getScreenBrightness
 */
export declare function getScreenBrightness$(params: IUnionGetScreenBrightnessParams): Promise<IUnionGetScreenBrightnessResult>;
export default getScreenBrightness$;
