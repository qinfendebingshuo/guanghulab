import { ICommonAPIParams } from '../../constant/types';
/**
 * 显示操作菜单 请求参数定义
 * @apiName showActionSheet
 */
export interface IUnionShowActionSheetParams extends ICommonAPIParams {
    items: string[];
    title: string;
    cancelButtonText: string;
}
/**
 * 显示操作菜单 返回结果定义
 * @apiName showActionSheet
 */
export interface IUnionShowActionSheetResult {
    index: number;
}
/**
 * 显示操作菜单
 * @apiName showActionSheet
 */
export declare function showActionSheet$(params: IUnionShowActionSheetParams): Promise<IUnionShowActionSheetResult>;
export default showActionSheet$;
