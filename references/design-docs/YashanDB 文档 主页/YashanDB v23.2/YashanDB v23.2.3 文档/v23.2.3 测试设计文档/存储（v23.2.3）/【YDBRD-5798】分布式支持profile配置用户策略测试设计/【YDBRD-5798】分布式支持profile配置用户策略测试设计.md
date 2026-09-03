Created by 易文亮, last modified on 六月 11, 2024

# 1.   **概述**

-   [1. 概述](#id-【YDBRD5798】分布式支持profile配置用户策略测试设计-1.概述)  
-   [2. 需求分析](#id-【YDBRD5798】分布式支持profile配置用户策略测试设计-2.需求分析)  
    -   [2.1 SR：profile支持IDLE_TIME和SESSIONS_PER_USER功能项](#id-【YDBRD5798】分布式支持profile配置用户策略测试设计-2.1SR：profile支持IDLE_TIME和SESSIONS_PER_USER功能项)  
    -   [2.2 SQL语法](#id-【YDBRD5798】分布式支持profile配置用户策略测试设计-2.2SQL语法)  
    -   [2.3 参数规格](#id-【YDBRD5798】分布式支持profile配置用户策略测试设计-2.3参数规格)  
    -   [2.4 相关视图](#id-【YDBRD5798】分布式支持profile配置用户策略测试设计-2.4相关视图)  
-   [3. 测试设计方法 ](#id-【YDBRD5798】分布式支持profile配置用户策略测试设计-3.测试设计方法)  
    -   [3.1 特性关联领域分析：](#id-【YDBRD5798】分布式支持profile配置用户策略测试设计-3.1特性关联领域分析：)  
    -   [3.2 测试设计：](#id-【YDBRD5798】分布式支持profile配置用户策略测试设计-3.2测试设计：)  
-   [4. 详细测试设计](#id-【YDBRD5798】分布式支持profile配置用户策略测试设计-4.详细测试设计)  
    -   [4.1 语法](#id-【YDBRD5798】分布式支持profile配置用户策略测试设计-4.1语法)  
    -   [4.2 功能](#id-【YDBRD5798】分布式支持profile配置用户策略测试设计-4.2功能)  
    -   [4.3 dba_profiles视图](#id-【YDBRD5798】分布式支持profile配置用户策略测试设计-4.3dba_profiles视图)  
    -   [4.4 profile权限](#id-【YDBRD5798】分布式支持profile配置用户策略测试设计-4.4profile权限)  
    -   [4.5 资料测试](#id-【YDBRD5798】分布式支持profile配置用户策略测试设计-4.5资料测试)  
-   [5. 测试用例设计](#id-【YDBRD5798】分布式支持profile配置用户策略测试设计-5.测试用例设计)  
-   [6. 测试框架设计](#id-【YDBRD5798】分布式支持profile配置用户策略测试设计-6.测试框架设计)  
-   [7. 测试环境说明](#id-【YDBRD5798】分布式支持profile配置用户策略测试设计-7.测试环境说明)  
-   [8. 工作量说明](#id-【YDBRD5798】分布式支持profile配置用户策略测试设计-8.工作量说明)  


本文描述  profile支持设置password/resource parameter功能项的  测试设计。

# 2.   **需求分析**

### 2.1 SR：profile支持IDLE_TIME和SESSIONS_PER_USER功能项

链接：       [https://pingcode.yasdb.com/pjm/items/660f86c8579a3edb84d30d63](https://pingcode.yasdb.com/pjm/items/660f86c8579a3edb84d30d63)    ?    
  #YDBRD-5798 分布式支持密码策略

设计文档：    [分布式密码策略](109053428.html)  

需求描述：

1. 支持create profile指定password parameter  ~~|resource parameter~~    
  2. 支持drop profile    
  3. 支持alter profile修改profile的限制    
  4. 支持create/alter user指定profile    
  5. 支持create profile, alter profile, drop profile权限

需求范围：  分布式

相关功能测试设计：    [profile测试设计（password parameter）](https://conf.yasdb.com/pages/viewpage.action?pageId=147776846)    、    [【YDBRD-29796】profile支持IDLE_TIME和SESSIONS_PER_USER功能项 测试设计](https://conf.yasdb.com/pages/viewpage.action?pageId=147776859)    ~~、黑白名单~~

### 2.2 SQL语法

  


CREATE/ALTER PROFILE profile_name {FAILED_LOGIN_ATTEMPTS|PASSWORD_LIFE_TIME|PASSWORD_REUSE_TIME|PASSWORD_REUSE_MAX|PASSWORD_LOCK_TIME|PASSWORD_GRACE_TIME} <integer>;

DROP   PROFILE profile_name [CASCADE];

profile限制赋权给user关联语法

create/alter user u1 profile profileName;

### 2.3 参数规格

1. ~~sessions_per_user限制一个用户可以同时发起的会话上限，配置值为[1, 2147483646]的整数~~
1. ~~idle_time限制用户会话最长的空闲无操作时间，服务端将巡检如果某个会话超过限制时间无操作，将会断开该链接释放会话资源。 idle_time配置值单位为分钟，取值为[1, 2147483646]的整数值。~~
1. FAILED_LOGIN_ATTEMPTS：指定在帐户被锁定之前所允许尝试登陆的的最大次数，默认10。
1. Password_life_time：指定同一密码所允许使用的天数。如果同时指定了password_grace_time参数，如果在grace period内没有改变密码，则密码会失效，连接数据库被拒绝。如果没有设置password_grace_time参数，默认值unlimited将引发一个数据库警告，但是允许用户继续连接。
1. Password_reuse_time和password_reuse_max：这两个参数必须互相关联设置，password_reuse_time指定了密码不能重用前的天数，而password_reuse_max则指定了当前密码被重用之前密码改变的次数，即多少次之内不许设置重复密码。两个参数都必须被设置为整数。    
     1) 如果为这两个参数指定了整数，则用户在PASSWORD_REUSE_MAX指定的天数内，用户不能重复使用密码，直到密码被修改的次数达到PASSWORD_REUSE_TIME指定的数量。如：password_reuse_time=30，password_reuse_max=10，用户可以在30天以后重用该密码，要求密码必须被改变超过10次。    
     2) 如果指定了其中的一个为整数，而另一个为unlimited，则用户永远不能重复使用一个密码。    
     3) 如果两个参数都设置为unlimited，则数据库忽略他们。
1. Password_lock_time：指定登陆尝试失败次数到达后帐户的锁定时间，以天为单位。
1. Password_grace_time：指定宽限天数，数据库发出警告到登陆失效前的天数。如果数据库密码在这中间没有被修改，则过期会失效。
1. Password_verify_function（不支持）：该字段允许将复杂的PL/SQL密码验证脚本做为参数传递到create profile语句。提供了一个默认的脚本，但是自己可以创建自己的验证规则或使用第三方软件验证。 对Function名称，指定的是密码验证规则的名称，指定为Null则意味着不使用密码验证功能。如果为密码参数指定表达式，则该表达式可以是任意格式，除了数据库标量子查询。
1. 该需求的目的是限制用户对会话资源的滥用，sys用户为超级管理员用户，不受对应约束。（和oracle一致）


### 2.4 相关视图

**dba_profiles**

|字段|Null? |Type|说明|
|---|---|---|---|
|PROFILE|NOT NULL|VARCHAR2(128)|  
|
|RESOURCE_NAME|NOT NULL|VARCHAR2(32)|  
|
|RESOURCE_TYPE|  
|VARCHAR2(8)|  
|
|LIMIT|  
|VARCHAR2(128)|  
|


**视图会新增resource_name为**  **IDLE_TIME和SESSIONS_PER_USER的记录，type=KERNEL，LIMIT=DEFAULT**

**default profile**

select * from dba_profiles where PROFILE = 'DEFAULT' and resource_name in('  IDLE_TIME  ','  SESSIONS_PER_USER  ');

select username,profile from dba_users where username='USER_NAME';

资源项系统表RESOURCE_MAP$、PROFILE$

# 3.   **测试设计方法**   

### 3.1 特性关联领域分析：

1. 视图：dba_profiles，确认profile是否与创建/修改指定的一致
1. create/alter/drop profile语法及功能是否生效
1. create/alter user u1 profile profileName语法及功能是否生效
1. 并发：create之间的并发，alter之间的并发
1. 内存泄漏：反复create/alter/drop profile，查询V$DICT_CACHE视图，不会出现内存泄漏
1. ha场景：备机可查询，但创建报错，修改的profile在备机上生效
1. 规格：profile数量上限10k 
1. 错误密码登录，会记录lcount，登录成功/unlock/过p  assword_lock_time  会清零，了解用户status变化，open->


### 3.2 测试设计：

主要采用  场景法和错误推测法进行设计

1. 语法验证：采用等价类和边界值法，针对语法进行覆盖，主要验证profile语法是否正常，报错是否明确
1. 功能验证：触发profile限制，受限及受限后的表现，改大改小profile，采用场景法，异常场景结合错误推测法
1. ~~结合数据库的session相关参数MAX_SESSIONS=1024和操作系统参数open files=1048576/max user processes=65535~~


|系统级DFX分类|是否涉及|备注|
|:---|:---|---|
|CT|Y|  
|
|DFR|N|已有看护，本次只是新增参数|
|HA|Y|  
|
|KT|Y|  
|
|一致性|N|资源与事务无关|
|三方测试工具    
  (sqltest，sqlancer)|N|  
|
|压力|N|  
|
|可维护性|N|  
|
|安全|N|  
|
|性能|N|  
|
|长稳|N|  
|


# 4.   **详细测试设计**

### 4.1 语法

|模块|输入条件|有效等价类|无效等价类|备注|
|---|---|---|---|---|
|create profile|profile名称|名称正常输入、包含特殊字符|名称使用特殊字符、数字开头|  
|
|  
|  
|名称长度64位|名称长度超过64位|  
|
|  
|  
|  
|名称使用标识符报错|  
|
|  
|  
|  
|名称为空、空串|  
|
|  
|  
|  
|名称重复|  
|
|  
|profile，limit，Password_parameters，expr等参数|多个密码参数组合|profile缺失|  
|
|  
|  
|关键字大小写混合|limit缺失|  
|
|  
|  
|Password_parameters大小写混合|Password_parameters缺失|  
|
|  
|  
|  
|expr、unlimited、default等缺失|  
|
|  
|  
|  
|SESSIONS_PER_USER/IDLE_TIME重复|  
|
|  
|FAILED_LOGIN_ATTEMPTS|设置为1|设置为0|【1，2147483646】  单位为次数|
|  
|  
|设置为2147483646，3.0（成功）|设置为2147483647|  
|
|  
|  
|  
|设置为小数1.5|  
|
|  
|  
|unlimited大小写混合|unlimited/default拼写错误|  
|
|  
|  
|default大小写混合|expr和unlimited/default同时使用|  
|
|  
|  
|设置为表达式（函数、算数）|  
|  
|
|  
|PASSWORD_LIFE_TIME|设置为1|设置为0|【1，24855】  单位为天，需要换算成天，产品文档测试需要关注单位为天|
|  
|  
|设置为  24855|设置为  24856|  
|
|  
|  
|设置为小数1.5，3.0（成功）|  
|  
|
|  
|  
|unlimited大小写混合|unlimited/default拼写错误|  
|
|  
|  
|default大小写混合|expr和unlimited/default同时使用|  
|
|  
|  
|设置为表达式（函数、算数）|  
|  
|
|  
|PASSWORD_REUSE_TIME|设置为1|设置为0|  
|
|  
|  
|设置为  24855|设置为  24856|  
|
|  
|  
|设置为小数1.5，3.0（成功）|  
|  
|
|  
|  
|unlimited大小写混合|unlimited/default拼写错误|  
|
|  
|  
|default大小写混合|expr和unlimited/default同时使用|  
|
|  
|  
|设置为表达式（函数、算数）|  
|  
|
|  
|PASSWORD_REUSE_MAX|设置为1|设置为0|  
|
|  
|  
|设置为2147483646|设置为2147483647|  
|
|  
|  
|设置为小数1.5，3.0（成功）|  
|  
|
|  
|  
|unlimited大小写混合|unlimited/default拼写错误|  
|
|  
|  
|default大小写混合|expr和unlimited/default同时使用|  
|
|  
|  
|设置为表达式（函数、算数）|  
|  
|
|  
|PASSWORD_LOCK_TIME|设置为1|设置为0|  
|
|  
|  
|设置为  24855|设置为  24856|  
|
|  
|  
|设置为小数1.5，3.0（成功）|  
|  
|
|  
|  
|unlimited大小写混合|unlimited/default拼写错误|  
|
|  
|  
|default大小写混合|expr和unlimited/default同时使用|  
|
|  
|  
|设置为表达式（函数、算数）|  
|  
|
|  
|PASSWORD_GRACE_TIME|设置为0、1|  
|【0，2147483646】|
|  
|  
|设置为  24855|设置为  24856|  
|
|  
|  
|unlimited大小写混合|unlimited/default拼写错误|  
|
|  
|  
|default大小写混合|expr和unlimited/default同时使用|  
|
|  
|  
|设置为小数1.5，3.0（成功）|  
|  
|
|  
|  
|设置为表达式（函数、算数）|  
|  
|
|  
|  
|6种密码参数同时使用|参数名称写错|  
|
|  
|~~SESSIONS_PER_USER~~|设置为1|设置为0|【1，2147483646】单位为个,正整数|
|  
|  
|设置为2147483646，3.0（成功）|设置为2147483647|补充验证create/alter profile带resource/IP parameter报错拦截|
|  
|  
|  
|设置为小数1.5|  
|
|  
|  
|  
|设置字符串abc、'abc'、*|  
|
|  
|  
|unlimited大小写混合|unlimited/default拼写错误|  
|
|  
|  
|default大小写混合|expr和unlimited/default同时使用|  
|
|  
|  
|设置为表达式（函数、算数）计算后在范围内|设置为表达式（函数、算数）计算后在范围外|  
|
|  
|~~IDLE_TIME~~|设置为1|设置为0,  设置为2147483647|【1，2147483646】单位为分钟,正整数|
|  
|  
|设置为2147483646|设置为小数1.5|  
|
|  
|  
|3.0（成功）|设置字符串abc、'abc'、*|  
|
|  
|  
|unlimited大小写混合|unlimited/default拼写错误|  
|
|  
|  
|default大小写混合|expr和unlimited/default同时使用|  
|
|  
|  
|设置为表达式（函数、算数）计算后在范围内|设置为表达式（函数、算数）计算后在范围外|  
|
|alter profile|/|修改expr的值|名称不存在|  
|
|  
|  
|修改为default|修改expr为超范围的非法值|  
|
|  
|  
|修改为unlimited|profile，limit，Password_parameters，expr等关键字缺失或写错|  
|
|  
|  
|修改default profile|  
|  
|
|drop profile|/|正常删除|名称不存在|  
|
|  
|  
|带cascade（未关联user时）|关联user时，不带cascade|  
|
|  
|  
|不带cascade（未关联user时）|删除Default profile|  
|
|  
|  
|关联user时，带cascade|  
|  
|
|  
|  
|删除profile后，校验user对应的profile密码限制不生效|  
|  
|
|create user u1 profile profileName.|create user u1 profile profileName.|正常输入|user已存在|  
|
|  
|  
|  
|profileName不存在|  
|
|  
|  
|  
|profile关键字写错|  
|
|  
|  
|一个profile关联多个用户|和多个profile关联|  
|
|alter user u1 profile profileName.|alter user u1 profile profileName.|正常修改|user不存在|  
|
|  
|  
|  
|profileName不存在|  
|
|  
|  
|  
|profile关键字写错|  
|


### 4.2 功能

|序号|测试场景|备注|
|---|---|---|
|1|create profile limit FAILED_LOGIN_ATTEMPTS 3，关联user1，登录该用户，使用错误密码3次，第4次登录时报错，账户会被锁定，再次修改不会报错|  
|
|2|用户被锁定后，修改/更换profile成功，操作后用户仍是锁定状态|  
|
|3|alter profile limit FAILED_LOGIN_ATTEMPTS default，登录该用户，使用错误密码10次，第11次登录时报错|默认尝试10次|
|4|alter profile limit FAILED_LOGIN_ATTEMPTS unlimited，登录该用户，使用错误密码任意次，仍能登录成功|  
|
|5|create profile limit PASSWORD_LIFE_TIME 3，关联user1，登录该用户，3天内/3天后分别使用该密码登录，3天后登录报错|  
|
|6|alter profile limit PASSWORD_LIFE_TIME default，关联user1，登录该用户，180天内/180天后分别使用该密码登录，180天后登录报错|默认180天|
|7|alter profile limit PASSWORD_LIFE_TIME unlimited，关联user1，登录该用户，一直不会过期|  
|
|8|create profile limit PASSWORD_REUSE_TIME 3，关联user1，3天内/3天后修改user的密码为user1的密码，3天内修改报错，3天后修改成功|  
|
|9|alter profile limit PASSWORD_REUSE_TIME default，关联user1，30天内/30天后修改user的密码为user1的密码，30天内修改报错，30天后修改成功|默认值30天|
|10|alter profile limit PASSWORD_REUSE_TIME unlimited，关联user1，不限制|  
|
|11|create profile limit PASSWORD_REUSE_MAX 3，关联user1，3次内/3次后修改user的密码为user1的密码，3次内修改报错，第4次修改成功|  
|
|12|alter profile limit PASSWORD_REUSE_MAX default，关联user1，5次内/5次后修改user的密码为user1的密码，5次内修改报错，第4次修改成功|默认值5次|
|13|alter profile limit PASSWORD_REUSE_MAX unlimited，关联user1，可一直复用|  
|
|14|create profile limit PASSWORD_LOCK_TIME 3，关联user1，指定登陆尝试失败次数到达后帐户的缩定时间为3天，3天内登录报错，第4天输入正确密码登录成功|  
|
|15|alter profile limit PASSWORD_LOCK_TIME default，关联user1，指定登陆尝试失败次数到达后帐户的缩定时间为1天，1天内登录报错，第2天输入正确密码登录成功|默认值1天|
|16|alter profile limit PASSWORD_LOCK_TIME unlimited，关联user1，指定登陆尝试失败次数到达后账户会一直被锁定|  
|
|17|create profile limit PASSWORD_GRACE_TIME 3，关联user1，校验数据库发出警告到登陆失效前的天数为3天|  
|
|18|create profile limit PASSWORD_LIFE_TIME 3 PASSWORD_GRACE_TIME 3，关联user1，第4天登录该账户会有告警，第8天登录报错|  
|
|19|alter profile limit PASSWORD_GRACE_TIME default，关联user1，校验数据库发出警告到登陆失效前的天数为7天|默认值7天|
|20|alter profile limit PASSWORD_GRACE_TIME unlimited，关联user1，校验数据库发出警告后可以一直登录|  
|
|21|create profile limit 6种参数都限制，全部生效|  
|
|22|alter profile limit 6种参数都修改，全部生效|  
|
|23|Password_reuse_time和password_reuse_max，全部设置为unlimited，不限制|  
|
|24|Password_reuse_time和password_reuse_max，一个设置为整数，一个设置为unlimited，只限制设置为整数的|  
|
|25|User过期后修改PASSWORD_LIFE_TIME增加也没有用|  
|
|26|User对应profile的password_life_time增加，相应的exptime也会增加（登录时计算），比如原来的过期时间是15：00， 给password_life_time增加一小时，系统表上还是15：00，实际的过期时间是16：00（视图可以查看到实际过期时间）； 直接alter user profile xxx，实际的exptime有改变|  
|
|27|当user进入expired（grace)状态后，改变password_grace_time不会改变最终过期时间|  
|
|28|cn  1  创建  profile  赋权给  user1  ，  cn2  修改后  cn  和dn确认配置及功能限制|  
|
|29|给sys用户赋予触发密码重试错误次数  ，确认是否被锁受限，不受限制|  
|
|30|给sys用户赋予密码期限的profile，达到期限后，确认密码是否过期，不会受限过期|  
|
|31|并发：create之间的并发，alter之间的并发|  
|
|32|内存泄漏：反复create/alter/drop profile，查询V$DICT_CACHE视图，不会出现内存泄漏|  
|
|33|分布式ha场景：CN主机创建的profile，在备机可查询且能够生效|  
|
|34|分布式ha场景：某些主或者备节点锁定的账户，不影响其他未被锁节点登录|  
|
|35|分布式ha场景：在CN主机上修改的profile，在备机上查询修改成功，且生效|  
|
|36|分布式ha场景：ha场景：在非CN节点和备机上非sys用户create/alter/drop profile报错（sys用户未做限制）,备机sys用户不支持create/alter/drop profile报错|  
|
|37|分布式ha场景：ha场景：备机switchover/failover后，cn的新主create/alter/drop成功|  
|
|38|升级场景：  23.2.1--->23.2.2  版本升级后，  profile  依然有效|  
|
|39|密码过期后重置密码时，输入回车，修改失败，报错，session断连|  
|
|40|密码过期后重置密码时，两次密码一致，修改成功，session连接成功|  
|
|41|密码过期后重置密码时，两次密码不一致，修改失败，session断连|  
|
|42|密码过期后重置密码时，不符合  reuse  条件，修改失败，  session  断连   |  
|
|43|密码过期后重置密码时，设置的密码不满足密码复杂度要求，修改失败，session断连|  
|


分布式相关测试场景（dn的sys用户可以alter user、cn上解锁修改密码会修改所有节点，dn只能影响本节点，单个节点被限制不影响其他节点使用 ）

|序号|内容|备注|
|---|---|---|
|1|分布式各节点相互独立，设置  FAILED_LOGIN_ATTEMPTS   3,CN1尝试错误登录2次，CN2尝试错误登录1次，不会被锁，DN尝试错误登录3次以下也不会被锁，CN1触发3次错误密码登录被锁后，CN2/DN/MN能正常登录,CN1触发密码错误次数被锁，CN2能正常登录和执行业务，DN能正常登录和查询,DN触发密码错误次数被锁，CN1能正常登录，执行业务正常|  
|
|2|触发CN部分节点密码被锁，使用alter user unlock能解锁成功，解锁后能正常登录,触发DN部分节点密码被锁，使用alter user unlock能解锁成功，解锁后能正常登录,触发CN、DN部分节点密码被锁，使用alter user unlock能解锁成功，解锁后能正常登录,cn/dn的密码相互独立，需要各自解锁，dn也能执行alter user。(CN主节点能解锁所以节点，其他只能解锁节点自身)|  
|
|3|CN、DN部署在不同的节点上，修改系统时间，部分节点密码过期，会触发密码修改，没过期的无须修改能正常登录|  
|
|4|部分CN密码过期，触发重新修改，修改后能正常登录，不影响其他节点未修改前已连接的会话，修改后其他节点使用旧密码登录失败，新密码能登录成功|  
|
|5|部分DN/MN密码过期，登录DN触发报错，登录CN正常，使用CN修改密码后，能正常使用新密码登录DN|  
|
|6|密码都过期，CN1个节点重置密码，元数据同步，其他节点密码都变化可修改,DN密码修改，只影响DN自身|  
|
|7|CN和DN指定不同的profile，应用各自的profile策略，CN密码过期|  
|
|8|CN和DN指定不同的profile，应用各自的profile策略，DN密码过期|  
|
|9|CN和DN指定不同的profile，确认会应用各自的profile策略，分别验证CN被锁/DN被锁/MN被锁，CN/DN/MN都被锁的场景，解锁后能正常登录和执行业务|  
|
|10|CN修改用户的profile，修改的节点用户的profile变化，会同步到别的CN/DN/MN主节点,DN/MN及备机限制修改创建/修改/删除profile|  
|


### 4.3 dba_profiles视图

|序号|测试场景|预期结果|备注|
|:---:|:---|:---|:---|
|1|确认profile='default'的结果集|密码项、资源项  **TYPE、LIMIT正确**|  
|
|2|创建profile限制  password parameter  **，查询视图**,**确认CN/DN/MN内容**|视图有记录，且内容与限制的值一致，未指定的都是default,CN/DN/MN内容一致|  
|
|3|修改profile  **，查询视图**,**确认CN/DN/MN内容**|视图内容跟修改后的一致，指定的项被修改，未指定的不变,CN/DN/MN内容一致|  
|
|      4|DN/MN或者CN被节点修改,CN修改|只影响当前节点和备机的属性,所有节点属性变化|  
|


### 4.4 profile权限

|序号|测试场景|备注|
|:---:|:---|:---|
|1|SYS和DBA默认具有create/alter/drop profile权限，查询select GRANTEE, PRIVILEGE from DBA_SYS_PRIVS where PRIVILEGE in ('CREATE PROFILE','ALTER PROFILE','DROP PROFILE') and GRANTEE in ('DBA','SYS') order by 1,2;|返回3行，默认有create/alter/drop profile权限|
|2|创建用户，给用户授create/alter/drop profile权限，查询视图、校验权限生效|  
|
|3|创建用户和角色，给角色授create/alter/drop profile权限，再把角色给用户，查询视图、校验权限生效|  
|
|4|解除用户或者角色的create/alter/drop profile权限，查询视图、校验权限失效|  
|
|5|with admin option，级联授权，A授权给B，B授权给C|  
|
|6|循环授权报错：A授权给B，B授权给C，C授权给A|  
|
|7|重复赋予相同角色或权限，报错|  
|
|8|自己给自己授权报错|  
|
|9|给其他用户授予自己没有的权限，报错|  
|
|10|具有grant any privilege 权限的用户，可以进行授权|  
|
|11|A授权给B，B授权给C后，收回B的授权|  
|
|12|A授权给B，B授权给C后，直接收回C的权限|  
|


### 4.5 资料测试

新增profile语法，create/alter user中新增profile选项，dba_users中新增profile字段

profile权限的语法说明

# 5.  ** **  **测试用例设计**

[PROFILE_YDBRD29796测试用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkMWU4OTcwYzJhZjRmNTIxMDYzIiwicmVmX2lkIjoiNjczOTZkMWU3MjgyMDZlZmI5MmYxYjY4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA1OTkxLCJleHAiOjE3ODIzOTIzOTF9.Qd4YThZl3tbiWlEpYDdNpMiF7dQJenGSTwjOSIH6hpQ)

# 6.   **测试框架设计**

采用Guider框架，ha部分使用ha_regress框架，并发场景使用testkill框架

# 7.   **测试环境说明**

|服务器|  
|
|:---|:---|
|操作系统|Linux|
|部署|分布式|


# 8. 工作量说明

8人天

## Attachments:

[PROFILE_YDBRD29796测试用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkMWU4OTcwYzJhZjRmNTIxMDYzIiwicmVmX2lkIjoiNjczOTZkMWU3MjgyMDZlZmI5MmYxYjY4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA1OTkxLCJleHAiOjE3ODIzOTIzOTF9.Qd4YThZl3tbiWlEpYDdNpMiF7dQJenGSTwjOSIH6hpQ)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


[profile_ydbrd28097.xls](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkMWVhMWFkOWEzMzExZGM4ZWQ1IiwicmVmX2lkIjoiNjczOTZkMWU3MjgyMDZlZmI5MmYxYjY4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA1OTkxLCJleHAiOjE3ODIzOTIzOTF9.Yonakwn--2u5GWsqqWLLmBjibvbBa7TXp3SmaKKJbGQ)

 (application/vnd.ms-excel)    


[profile.xls](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkMWU4OTcwYzJhZjRmNTIxMDY1IiwicmVmX2lkIjoiNjczOTZkMWU3MjgyMDZlZmI5MmYxYjY4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA1OTkxLCJleHAiOjE3ODIzOTIzOTF9.D9sOrGdwIgJ5jNTLtWQ44lUoq9SgENtT2nKmHpOHg5g)

 (application/vnd.ms-excel)    


[image2022-12-26_9-57-42.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkMWU4OTcwYzJhZjRmNTIxMDY4IiwicmVmX2lkIjoiNjczOTZkMWU3MjgyMDZlZmI5MmYxYjY4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA1OTkxLCJleHAiOjE3ODIzOTIzOTF9.Au64GBDBVmxgZQgj9VDJA_LXwcVANT3JDhUd35dkxIQ)

 (image/png)    


[image2022-12-26_9-54-36.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkMWU4OTcwYzJhZjRmNTIxMDY5IiwicmVmX2lkIjoiNjczOTZkMWU3MjgyMDZlZmI5MmYxYjY4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA1OTkxLCJleHAiOjE3ODIzOTIzOTF9.GxG2qBi954zedhSGHn51PWzIRARggLUqG-LWttwsx6k)

 (image/png)    


[image2022-12-13_11-20-25.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkMWY4OTcwYzJhZjRmNTIxMDZhIiwicmVmX2lkIjoiNjczOTZkMWU3MjgyMDZlZmI5MmYxYjY4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA1OTkxLCJleHAiOjE3ODIzOTIzOTF9.XBPvZylXCu0uTkgy0lFhcJBVZt1SAMOEobfnI-R22Gg)

 (image/png)    


[image2022-12-13_11-19-23.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkMWZhMWFkOWEzMzExZGM4ZWQ5IiwicmVmX2lkIjoiNjczOTZkMWU3MjgyMDZlZmI5MmYxYjY4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA1OTkxLCJleHAiOjE3ODIzOTIzOTF9.hsHHDZFf_JK3ppiACl3osEe_DngR8QBS2OYNueno6ck)

 (image/png)    


[image2022-6-8_17-42-53.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkMWZhMWFkOWEzMzExZGM4ZWRiIiwicmVmX2lkIjoiNjczOTZkMWU3MjgyMDZlZmI5MmYxYjY4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA1OTkxLCJleHAiOjE3ODIzOTIzOTF9.nu6VBrh9UbI2NN5ZvUZj9Ey7jlRJNJi0yrWs8ZLXwWc)

 (image/png)    


[image2022-6-8_17-42-35.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkMWZhMWFkOWEzMzExZGM4ZWRjIiwicmVmX2lkIjoiNjczOTZkMWU3MjgyMDZlZmI5MmYxYjY4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA1OTkxLCJleHAiOjE3ODIzOTIzOTF9.Q2ulmHhVFkw01dAb_Dnl_YwxBoC5xD3VY98KDPCHo1o)

 (image/png)    


[image2022-10-19_10-28-18.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkMWY4OTcwYzJhZjRmNTIxMDZjIiwicmVmX2lkIjoiNjczOTZkMWU3MjgyMDZlZmI5MmYxYjY4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA1OTkxLCJleHAiOjE3ODIzOTIzOTF9.YaV5gLiLthr9XCOWJg5A9g6z63ODm2RznUugQhdkwCI)

 (image/png)    
