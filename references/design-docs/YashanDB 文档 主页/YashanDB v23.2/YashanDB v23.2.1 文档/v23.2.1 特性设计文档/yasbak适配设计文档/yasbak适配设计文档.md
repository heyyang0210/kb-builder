Created by 梁雄, last modified on 一月 19, 2024

  [YDBRD-21615](https://jira.yasdb.com/browse/YDBRD-21615?src=confmacro)    -  OM适配yasrman集群备份恢复  完成

##   [1. 总述](#1-总述)  

###   [1.1 需求来源](#11-需求来源)  

yasrman支持集群方式进行备份恢复，om需要适配yasrman的变化.经过跟TL、PL、测试确认，只需要yasbak适配yasrman的变化即可。

###   [1.2 调研文档](#12-调研文档)  

-   [集群支持RMAN概要设计文档](https://conf.yasdb.com/pages/viewpage.action?pageId=141580153)  


###   [1.3 需求分析](#13-需求分析)  

yasrman此次适配集群，命令行与单机一致，yasbak基本逻辑不做任何改变，需要验证如下几个方面

- 不同数据库架构下（yasrman，yasbak）
    - yasrman基本功能是否可用
    - 使用yasbak是否能够正常使用yasrman进行备份和恢复


###   [1.4 数据字典](#14-数据字典)  

无

###   [1.5 开源依赖](#15-开源依赖)  

无

##   [2. 接口](#2-接口)  

###   [yasbak deploy](#yasbak-deploy)  

本命令用于初始化yasbak和yasrman的运行环境。

|选项|含义|
|---|---|
|*-c,--cluster*|指定一个名称，该名称将用于配置数据库命名，一个数据库对应一个名称，建议与yasboot部署时的名称保持一致|
|*-a,--addr*|指定数据库的yasom访问地址，yasbak将通过该地址与yasom进行通信|
|*-k,--key*|连接yasom时校验的token，需要和yasom配置保持一致|
|*-D,--cata-log*|yasrman所使用的cata log，将指定路径生成该目录。若未初始化，将使用yasrman进行初始化，若已初始化将忽略。|
|*-u,--user*|连接数据库使用的用户名，后续执行备份时默认将使用该用户|
|*-p,--password*|连接数据库用户对应密码，该密码将通过多次加密后保存在本地配置文件内，执行clean可以清理配置。|
|*-t,--cert*|当yasom指定TLS加密通信时，需要指定对应的加密证书|
|*-S,--server*|当yasom指定server名称后，需要指定该名称|


###   [yasbak run](#yasbak-run)  

本命令用于执行yasman的备份、恢复、清理备份等语句。

|选项|含义|
|---|---|
|*-c,--cluster*|deploy时指定的cluster名称|
|*-s,--sql*|指定yasrman运行的SQL|
|*-u,--user*|执行yasrman使用的用户，若不指定将使用deploy时的用户名。|
|*-p,--password*|执行yasrman使用的密码，若不指定将使用deploy时的密码，yasbak解密后内部使用。|
|*-r,--role*|可选参数：primary、standby，使用指定类型节点进行备份操作。|
|*-a, --addr*|yasdb的连接地址，若提供该参数值，将指定这个节点，--role将失效|
|*-b,--build-all*|指定该参数，在恢复备份时是否恢复其他备节点|


###   [yasbak clean](#yasbak-clean)  

本命令用于清理初始化时生成的配置文件、元数据信息等。

|选项|含义|
|---|---|
|*-c,--cluster*|deploy时指定的cluster名称|
|*-f,--force*|是否进行信息确认，输入yes/no|
|*-p,--purge*|清理时是否同时删除 cata log目录|


##   [3. 规格与约束](#3-规格与约束)  

应用对象：

- 单机
- 分布式
- 集群


##   [4. 特性](#4-特性)  

##   [5. Testcases（自测用例）](#5-testcases自测用例)  

- 单机部署模式下yasbak能否正常运行
- 分布式模式下yasbak能否正常运行
- 集群模式下yasbak能否正常运行


##   [6.资料设计章节](#6资料设计章节)  

无

##   [7.未来规划](#7未来规划)  

无