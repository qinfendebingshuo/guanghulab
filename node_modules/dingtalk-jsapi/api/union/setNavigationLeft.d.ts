import { ICommonAPIParams } from '../../constant/types';
/**
 * 设置左侧导航按钮文本 请求参数定义
 * @apiName setNavigationLeft
 */
export interface IUnionSetNavigationLeftParams extends ICommonAPIParams {
    text: string;
    control?: boolean;
}
/**
 * 设置左侧导航按钮文本 返回结果定义
 * @apiName setNavigationLeft
 */
export interface IUnionSetNavigationLeftResult {
}
/**
 * 设置左侧导航按钮文本
 * @apiName setNavigationLeft
 */
export declare function setNavigationLeft$(params: IUnionSetNavigationLeftParams): Promise<IUnionSetNavigationLeftResult>;
export default setNavigationLeft$;
