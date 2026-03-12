export declare const apiName = "biz.wiki.openPage";
/**
 * 打开指定知识页 请求参数定义
 * @apiName biz.wiki.openPage
 */
export interface IBizWikiOpenPageParams {
    /** 知识页id */
    id: string;
    /** 知识库归属企业 */
    corpId?: string;
}
/**
 * 打开指定知识页 返回结果定义
 * @apiName biz.wiki.openPage
 */
export interface IBizWikiOpenPageResult {
}
/**
 * 打开指定知识页
 * @apiName biz.wiki.openPage
 * @supportVersion ios: 5.1.5 android: 5.1.5
 * @author Android：吾贤 iOS：弘煜
 */
export declare function openPage$(params: IBizWikiOpenPageParams): Promise<IBizWikiOpenPageResult>;
export default openPage$;
