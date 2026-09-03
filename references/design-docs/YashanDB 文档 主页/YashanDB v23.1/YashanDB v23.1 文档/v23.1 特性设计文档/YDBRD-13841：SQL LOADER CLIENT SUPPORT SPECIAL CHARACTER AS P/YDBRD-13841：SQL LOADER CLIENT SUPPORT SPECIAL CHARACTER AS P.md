Created by 朱月婷, last modified on 一月 18, 2024

  


#   [YDBRD-13841: SQL LOADER CLIENT SUPPORT SPECIAL CHARACTER AS PW Design](#ydbrd-13841-sql-loader-client-support-special-character-as-pw-design)  

SR链接：    [https://jira.yasdb.com/browse/YDBRD-13841](https://jira.yasdb.com/browse/YDBRD-13841)  

##   [1. Overview（概述）](#1-overview概述)  

当前用户名，密码包含@/，需要再次输入密码进行登录，无法通过命令行直接输入登录。 密码中包含@和/ ，支持yasldr通过命令行登录。

特殊符号包含：@ /

登录方式：yasldr USERNAME/PASSWORD@URL

##   [2. Features（功能特性）](#2-features功能特性)  

（1）密码包含@和/，如密码为：1@2/ 支持登录方式：

yasldr user1/"1@2/ "@127.0.0.1:1688

（2）用户名包含特殊@和/

yasldr \”user1@"/"1@2/ "@127.0.0.1:1688

注：

（1）用户名/密码中的特殊字符，必须包在合法的双引号内部。

（2）转义规格：由于终端会去除双引号，命令行式必须转义/交互式不能添加转义。如：

命令行：yasldr user1/"1@2/ "@127.0.0.1:1688

##   [3. Interfaces（接口）](#3-interfaces接口)  

##   [4. Specification And Constraints（规格与约束）](#4-specification-and-constraints规格与约束)  

- 密码/用户名，不支持空格；


参考yasql仅支持交互式登录带空格的用户和密码。

##   [5. Detail Design（详细设计）](#5-detail-design详细设计)  

decode流程：

connAggr：直到双引号外的空格为止

user/pwd@ip：

--ip分割双引号外的@为分隔符，后面为ip。

--user双引号外部的/为分隔符，分割user和pwd

###   [5.1 Architecture（架构）](#51-architecture架构)  

以下需要在win和linux下分别进行测试。

注：

（1）用户名大小写问题：

创建用户用户名登录“user1 ”user1“user1 ”user1USER1user1或USER1或“USER1”均可

（2）双引号：用户名密码均不带双引号。

- 密码包含@和/
- 用户名：USER1 密码:1@2/


drop user user1 cascade;

create user user1 identified by "1@2/";

grant dba to user1;

- 成功


yasldr user1/"1@2/"

yasldr user1/"1@2/"@127.0.0.1:1688

- 不带双引号，报错


yasldr user1/1@2/

- 用户名和密码都包含@和/
- 用户名："user1@/"密码:"1@2/",不带IP


drop user "user1@/" cascade;

create user "user1@/" identified by "1@2/";

grant dba to "user1@/";

yasldr "user1@/"/"1@2/"

- 用户名："user1@/"密码:"1@2/"，且带ip


yasldr "user1@/"/"1@2/"@127.0.0.1:1688

##   [6. Testcases（自测用例）](#6-testcases自测用例)  

设计开发人员自测用例（文字描述），给出开发者自测试的设计方案表格或者XMIND、开发自测的用例归档路径。

自测关注点：

1. 覆盖全面
1. 避免重复测试
1. 测试用例的可维护性


自测用例设计方法：

1. 边界值
1. 等价类
1. 正交


##   [7.资料设计章节](#7资料设计章节)  

资料在设计阶段，要识别出来相关需要调整的范围、大纲。

##   [8. TODO（遗留问题）](#8-todo遗留问题)  

*说明本方案遗留的问题或下一步需要解决的问题。*