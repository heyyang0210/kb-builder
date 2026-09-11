Created by 邬建川, last modified on 四月 25, 2024

*-SR链接：*

  [YDBRD-29822](https://jira.yasdb.com/browse/YDBRD-29822?src=confmacro)    -  v$session支持审计会话ID字段  设计中

##   [1. 总述](#1-总述)  

oracle审计记录中sessionid字段(也就是v$session中的audsid)，是在用户每次登录时从一个内部sequence中分配的，不等同于sid

sessionid 即可以作为会话的标识符，同时为审计记录提供了按每次登录的记录信息

本设计旨在兼容oracle，支持audsid(sessionid)字段

###   [1.1 需求来源](#11-需求来源)  

- 市场需求，  **来源**  ：博时基金   **场景**  ：oracle兼容
- 支持形态： 单机， 集群，分布式


###   [1.2 调研文档](#12-调研文档)  

  [https://conf.yasdb.com/pages/viewpage.action?pageId=150616257](https://conf.yasdb.com/pages/viewpage.action?pageId=150616257)  

####   [oracle 一般用法](#oracle-一般用法)  

#####   [审计系统表中的字段](#审计系统表中的字段)  

audSid从序列中获得，区分了系统与普通用户，同时可以按用户登录的次序管理审计。

- audSid = MAX_UINT32的 一定是系统用户的审计。
- 其他用户的每一次登录取sequence的nextval，增加了审计间的区分度（分布式/集群 下可以结合node_name来区分）。


#####   [查询用户当前会话信息](#查询用户当前会话信息)  

- 用户可以利用 userenv('sessionid') 和 v$session 获取用户当前会话的相关信息


使用语句:   **select * from v$session where audsid = userenv('sessionid')**

但是因为audsid不保证唯一，该用法不一定准确

###   [1.3 需求分析](#13-需求分析)  

兼容oracle支持audsid字段，由于yashandb的审计是纯unified auditing审计，因此支持的audsid表现和oracle 纯unified auditing的表现相同

因为userenv('sessionid') 与audsid 相同，且在实际使用中常用到，因此这个也要支持。

###   [1.4 数据字典](#14-数据字典)  

|术语|描述|借鉴业界|参考|
|---|---|---|---|
|audsid|审计会话id|是|  [https://docs.oracle.com/en/database/oracle/oracle-database/19/refrn/V-SESSION.html](https://docs.oracle.com/en/database/oracle/oracle-database/19/refrn/V-SESSION.html)  |


###   [1.5 开源依赖](#15-开源依赖)  

无

##   [2. 接口](#2-接口)  

###   [系统视图 & 动态视图](#系统视图--动态视图)  

####   [DV$SESSION、V$SESSION增加1个字段：](#dvsessionvsession增加1个字段)  

|字段|类型|说明|
|---|---|---|
|AUDSID|NUMBER|审计会话id|


audsid 审计会话id

###   [系统表](#系统表)  

####   [增加 sequence SYS.AUDSES$](#增加-sequence-sysaudses)  

|字段|值|含义|
|---|---|---|
|MINVALUE|1|序列最小值|
|MAXVALUE|2000000000|序列最大值|
|CACHE SIZE|10000|序列缓存大小|
|CYCLE|TRUE|序列达到最大值后，从 1 循环使用|


####   [变更系统表 AUD$UNIFIED 字段 SESSIONID的含义](#变更系统表-audunified-字段-sessionid的含义)  

|字段|原含义|变更后|
|---|---|---|
|SESSIONID|sid|audsid|


####   [内置函数userenv支持SESSIONID查询](#内置函数userenv支持sessionid查询)  

select userenv('sessionid') from dual;

该值等同于当前会话连接上来得到的audsid

##   [3. 规格与约束](#3-规格与约束)  

|规格/约束项|类型|规格、约束|原理|备注|
|---|---|---|---|---|
||规格|非系统用户连接时的audsid字段来自于sequence，如果sequence超过了最大值，则会从1开始复用（同oracle,在不进行alter sequence的情况下）|为审计按单次登录做了区分，兼容oracle||
||规格|系统用户连接时audsid为max_uint32|兼容oracle||
||规格|背景会话的audsid为0|兼容oracle||
||规格|直连 dn/mn/单机集群 备机 audsid为 max_uint32|兼容oracle||
||规格|直连 dn/mn/单机集群 主机 audsid分配同单机情况|||
||规格|多cn间audSid会存在相同|分布式下sequence是节点单独维护的||
||规格|audses$是noorder的，在集群部署下不同节点之间序列号分配不保证次序|audsid对次序没有要求||
||约束|分布式不支持alter sequence|||
||规格变更|aud$unified系统表sessionid的实际取值从sid 改为audsid|||
||规格|备升主时，为仍在连接状态的用户会话按audses$分配新的audsid|保证可写状态的会话有相应的audsid记录||
||规格|单机/集群 alter sequence audses$后，如果出现sequence无法取值nextval的情况，会导致非系统用户无法连接|sequence的限制，oracle也有同样的表现||
||规格|audsid参数的范围是0~max_uint32,设置sequence超过这个范围展示的值： 负数为0，大于max_uint32的数显示max_uint32|oracle兼容||


##   [4. 特性](#4-特性)  

- v/dv $session 视图增加 audsid字段
- 增加userenv('sessionid')


##   [5. 详细设计](#5-详细设计)  

###   [增加内部sequence，sys.audses$](#增加内部sequencesysaudses)  

sequence的参数值和oracle保持一致

|字段|含义|初始值|
|---|---|---|
|cache size|sequence缓存大小|10000|
|min value|sequence最小值|1|
|max value|sequence 最大值|2000000000|
|cycle|达到最大值是否循环|true|


###   [增加audsid字段，根据连接类型，为audsid赋值](#增加audsid字段根据连接类型为audsid赋值)  

AnlHanlderAttr结构体新增字段：

```
typedef struct StAnlHandlerAttr {
  CodUint32 audSid;  // 新增字段
} AnlHandlerAttr;

```

- 用户连接时，系统用户赋值为 max_uint32, 其他用户从sequence取值即 audses$.nextval
- background session 值为 0


login时，ankLogin之后（userId已经被正确赋值）， 调用接口

```
CodResult anlGenAudSid(AnlHandler* handler)
{
	// 1. 如果是sys用户 audsid为 max_uint32
	// 2. 其他用户调用 genNextAudSid
}

```

获取sequence nextval

```
static CodResult genNextAudSid(AnkHandler* handler, CodInt64* nextAudSid)
{
    // 1.打开sequence
	// 2. 获取nextval
}

```

单机同cn的逻辑

cn/dn建连时，因为建连会话是服务于cn会话，且不会有审计记录，dn上建连会话的audsid设为默认值 0

###   [更改AUD$UNIFIED系统表字段SESSIONID的含义](#更改audunified系统表字段sessionid的含义)  

sessionid字段从 sid 改为 audsid

###   [添加userenv('sessionid')](#添加userenvsessionid)  

在userEnvParam增加sessionid

```
typedef enum EnUserEnvParam {
    ...
    UENV_SESSIONID, // 用户连接时，分配的唯一标识符
    ...
}UserEnvParam;

```

添加取sessionid的函数

```
static CodResult uenvGetSessionid(AnlStmt* stmt, Variant* retValue)
{
    // 1. 从stmt的handler上拿取audsid即可
}

```

###   [备升主时，为已经连接的会话从audses$分配新的audsid](#备升主时为已经连接的会话从audses分配新的audsid)  

```
static CodResult promoteGenAudSid(AnlInstance* inst)
{
 // 1.遍历handler pool，为每个user类型的handler从audses$分配 audsid
}

```

##   [6. 自测](#6-自测)  

|测试点|预期|部署形态|状态|
|---|---|---|---|
|内部会话|audsid为0|分布式|pass|
|sys连接|audsid为max_uint32|分布式|pass|
|其他用户连接|audsid为sys.audses$的nextval|单机|pass|
|测试连接超过sequence最大值|下次连接audsid为 1|单机|pass|
|查询userenv('sessionid')值|与当前会话audsid一致|单机|pass|
|用户直连备机|audsid为 max_uint32|分布式|pass|
|非系统用户连接备机场景下，备升主|audsid从audses$重新分配|分布式|pass|
|审计系统表中sessionid字段的正确性|同audsid|单机|pass|
|将maxvalue设置的很小，同时nocycle|sequence用完后，新连接会失败|单机|pass|
|多个实例同时连接，没有cycle的情况下|生成的audsid不同|集群||


##   [7.资料设计](#7资料设计)  

- SESSIONID：用户每次连接时，为每个会话分配的唯一标识符，取自系统sequence，audses$。系统用户 sessionid总是为 MAX_UINT32, 背景会话的SESSIONID为 0
- UNIFIED_AUDIT_TRAIL 修改SESSIONID 字段的含义


##   [8.未来规划](#8未来规划)  

略