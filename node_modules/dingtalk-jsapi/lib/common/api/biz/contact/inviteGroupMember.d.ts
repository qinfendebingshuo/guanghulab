export declare const apiName = "biz.contact.inviteGroupMember";
/**
 * 企业或部门 添加团队成员页面 请求参数定义
 * @apiName biz.contact.inviteGroupMember
 */
export interface IBizContactInviteGroupMemberParams {
    /** 企业 corpId */
    corpId: string;
    /** 部门Id */
    deptId?: number;
    /** 业务方标识 */
    scene?: string;
    /** 上游业务来源 */
    origin?: number;
    /** 上游业务来源描述 */
    originMeta?: string;
}
/**
 * 企业或部门 添加团队成员页面 返回结果定义
 * @apiName biz.contact.inviteGroupMember
 */
export interface IBizContactInviteGroupMemberResult {
    invitedMembers: Array<{
        staffId: string;
        userName: string;
        mobile: string;
        job?: string;
    }>;
}
/**
 * 企业或部门 添加团队成员页面
 * @apiName biz.contact.inviteGroupMember
 * @supportVersion ios: 4.6.37 android: 4.6.37
 */
export declare function inviteGroupMember$(params: IBizContactInviteGroupMemberParams): Promise<IBizContactInviteGroupMemberResult>;
export default inviteGroupMember$;
