export declare const apiName = "internal.bizcard.friendCategories";
/**
 * 根据类型获取该类型的分组信息 请求参数定义
 * @apiName internal.bizcard.friendCategories
 */
export interface IInternalBizcardFriendCategoriesParams {
    /** 'tag','org','title' */
    category: string;
}
/**
 * 根据类型获取该类型的分组信息 返回结果定义
 * @apiName internal.bizcard.friendCategories
 */
export interface IInternalBizcardFriendCategoriesResult {
    data: Array<{
        name: any;
        categoryValue: any;
        count: any;
    }>;
}
/**
 * 根据类型获取该类型的分组信息
 * @apiName internal.bizcard.friendCategories
 * @supportVersion ios: 4.5.17 android: 4.5.17
 */
export declare function friendCategories$(params: IInternalBizcardFriendCategoriesParams): Promise<IInternalBizcardFriendCategoriesResult>;
export default friendCategories$;
