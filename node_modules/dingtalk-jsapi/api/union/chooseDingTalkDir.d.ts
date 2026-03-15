import { ICommonAPIParams } from '../../constant/types';
/**
 * 选取钉盘目录 请求参数定义
 * @apiName chooseDingTalkDir
 */
export interface IUnionChooseDingTalkDirParams extends ICommonAPIParams {
    corpId: string;
}
/**
 * 选取钉盘目录 返回结果定义
 * @apiName chooseDingTalkDir
 */
export interface IUnionChooseDingTalkDirResult {
    data: {
        path: string;
        dirId: string;
        spaceId: string;
    }[];
}
/**
 * 选取钉盘目录
 * @apiName chooseDingTalkDir
 */
export declare function chooseDingTalkDir$(params: IUnionChooseDingTalkDirParams): Promise<IUnionChooseDingTalkDirResult>;
export default chooseDingTalkDir$;
