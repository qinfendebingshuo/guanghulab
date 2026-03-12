export declare const apiName = "internal.contact.queryPickedResult";
/**
 * 从选人组件缓存中获取已选择的成员列表 请求参数定义
 * @apiName internal.contact.queryPickedResult
 */
export interface IInternalContactQueryPickedResultParams {
    /** 从选人组件已选缓存中获取结果的key (此token由选人组件产生，通过url参数等方式提前传递到小程序) */
    token: string;
}
/**
 * 从选人组件缓存中获取已选择的成员列表 返回结果定义
 * @apiName internal.contact.queryPickedResult
 */
export interface IInternalContactQueryPickedResultResult {
    selectedCount: number;
    users: Array<{
        name: string;
        avatar: string;
        uid: string;
        encryptionUid: string;
        emplId: string;
    }>;
    token: string;
}
/**
 * 从选人组件缓存中获取已选择的成员列表
 * @apiName internal.contact.queryPickedResult
 * @supportVersion ios: 5.0.2 android: 5.0.2
 * @author android：宇睿，ios：鱼非
 */
export declare function queryPickedResult$(params: IInternalContactQueryPickedResultParams): Promise<IInternalContactQueryPickedResultResult>;
export default queryPickedResult$;
