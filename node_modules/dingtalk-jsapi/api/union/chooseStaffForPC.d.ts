import { ICommonAPIParams } from '../../constant/types';
/**
 * PC端选择企业内部的人 请求参数定义
 * @apiName chooseStaffForPC
 */
export interface IUnionChooseStaffForPCParams extends ICommonAPIParams {
    max?: number;
    users?: string[];
    corpId: string;
    multiple?: boolean;
}
/**
 * PC端选择企业内部的人 返回结果定义
 * @apiName chooseStaffForPC
 */
export interface IUnionChooseStaffForPCResult {
    name: string;
    avatar: string;
    emplId: string;
}
/**
 * PC端选择企业内部的人
 * @apiName chooseStaffForPC
 */
export declare function chooseStaffForPC$(params: IUnionChooseStaffForPCParams): Promise<IUnionChooseStaffForPCResult>;
export default chooseStaffForPC$;
