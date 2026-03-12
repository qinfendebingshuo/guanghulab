import { ICommonAPIParams } from '../../constant/types';
/**
 * 使用内置地图查看位置 请求参数定义
 * @apiName openLocation
 */
export interface IUnionOpenLocationParams extends ICommonAPIParams {
    title: string;
    address: string;
    latitude: string;
    longitude: string;
}
/**
 * 使用内置地图查看位置 返回结果定义
 * @apiName openLocation
 */
export interface IUnionOpenLocationResult {
}
/**
 * 使用内置地图查看位置
 * @apiName openLocation
 */
export declare function openLocation$(params: IUnionOpenLocationParams): Promise<IUnionOpenLocationResult>;
export default openLocation$;
