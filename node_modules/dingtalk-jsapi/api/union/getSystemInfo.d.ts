import { ICommonAPIParams } from '../../constant/types';
/**
 * 获取手机系统信息 请求参数定义
 * @apiName getSystemInfo
 */
export interface IUnionGetSystemInfoParams extends ICommonAPIParams {
}
/**
 * 获取手机系统信息 返回结果定义
 * @apiName getSystemInfo
 */
export interface IUnionGetSystemInfoResult {
    app: string;
    brand: string;
    model?: string;
    system?: string;
    storage?: string;
    version?: string;
    language?: string;
    platform?: string;
    pixelRatio?: number;
    orientation: number;
    screenWidth?: number;
    windowWidth?: number;
    screenHeight?: number;
    windowHeight?: number;
    currentBattery?: string;
    titleBarHeight: number;
    fontSizeSetting?: number;
    statusBarHeight: number;
}
/**
 * 获取手机系统信息
 * @apiName getSystemInfo
 */
export declare function getSystemInfo$(params: IUnionGetSystemInfoParams): Promise<IUnionGetSystemInfoResult>;
export default getSystemInfo$;
