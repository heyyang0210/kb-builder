Created by 施新华, last modified on 十一月 14, 2023

# **1、概述**

**本文档主要是使用OM管理YashanDB的巡检&巡检策略的测试设计**

**设计文档：**

**SR:**  ** **

  [YDBRD-13293](https://jira.yasdb.com/browse/YDBRD-13293?src=confmacro)    **-**  **【OM】添加单机巡检项**  **完成**

  [YDBRD-13287](https://jira.yasdb.com/browse/YDBRD-13287?src=confmacro)    **-**  **【OM】支持巡检策略和配置框架**  **完成**

  [YDBRD-13257](https://jira.yasdb.com/browse/YDBRD-13257?src=confmacro)    **-**  **【OM】支持分布式数据库巡检能力**  **完成**

# **2、需求分析**

## **2.1 需求描述**

**om支持YashanDB巡检&巡检策略**

## **2.2 功能特性**

**yasboot新增巡检相关命令：**

-   

    - 巡检策略
    - 巡检报告
- **2.3 特性约束**


|命令|说明|
|:---|:---|
|patrol strategy gen|生成巡检策略配置文件|
|patrol strategy add|添加巡检策略|
|patrol strategy apply|应用巡检策略|
|patrol strategy cancel|取消应用巡检策略|
|patrol strategy delete|删除巡检策略|
|patrol strategy list|展示巡检策略列表|


|命令|说明|
|:---|:---|
|patrol report list|展示巡检报告列表|
|patrol report get|获取巡检报告详细信息|
|patrol report delete|删除巡检报告|
|patrol report create|立即发起巡检，并生成巡检报告|


    - 支持单机
    - 巡检策略
        - 生成巡检策略配置文件
            - 巡检对象(数据库名称)
            - 支持配置巡检项
                - 支持按照模块和最小巡检项配置
                - db巡检项：    [https://conf.yasdb.com/pages/viewpage.action?pageId=113969768](https://conf.yasdb.com/pages/viewpage.action?pageId=113969768)  
            - 支持按每月/周/天/时巡检
        - 应用巡检策略
        - 取消应用巡检策略
        - 删除巡检策略
        - 展示巡检策略
    - 巡检报告
        - 展示巡检报告
            - 巡检报告列表、详情
        - 下载巡检报告
        - 删除巡检报告
        - 创建巡检
            - 立即发起巡检，并生成巡检报告
    - 巡检报告只支持保存在OM所在主机
    - db巡检报告只支持    `json`    输出格式
    -   `PERIOD`    类型策略下发的巡检任务的最小间隔时间为1小时
    - 巡检策略下发任务时，前一次巡检任务没有完成，当前巡检任务会下发任务失败
    - db巡检sql该迭代不做检查
    - 巡检项之间相互独立，某个巡检项执行失败，不会导致巡检任务失败，以及影响到其它巡检项


# **3、测试设计方法**

### 3.1 特性关联领域分析：

1. 功能性：语法、结合业务场景
1. 部署形态：单机（一主两备）同机部署、跨机部署、打开自选主
1. 测试环境：linux
1. 可靠性、异常：异常环境
1. 易用性：使用过程是否简单易上手，报错是否明确


# **4、详细测试设计**

## **4.1 语法验证**

|命令|参数|说明|测试策略|预期|结果|备注|
|:---|:---|:---|:---|:---|:---|:---|
|patrol strategy gen,(生成巡检策略配置文件),  
    
    
    
    
    
    
    
    
    
    
    
    
|**--cluster, -c**|集群名称，必填项|--cluster yashan,-c yashan|成功|pass|  
|
||**--strategy-name, -s**|策略名称，必填项|--strategy-name patrol1,-s patrol2|成功|pass|  
|
||**--strategy-type, -t**|策略类型，默认为    `PERIOD`    ，可选值(不区分大小写)有：,-   `PERIOD`    ：周期性巡检策略，可执行多次
-   `TIMING`    ：定时巡检策略，执行一次
|--strategy-type period,--strategy-type timing,-t period, -t timing|成功|pass|  
|
||**--cron-expression，-ce**|  `cron`    表达式 (设置了该参数，下面三个参数失效),- 格式：    `* * * * *`    ，分别表示：    `分钟、小时、天、月、周`  
|  
|成功|pass|  
|
||**--frequency，-f**|巡检频率，默认为    `weekly`    ，可选值如下：,-   `monthly`    ：每月
-   `weekly`    ：每周，默认值
-   `daily`    ：每天
-   `hourly`    ：每小时
|--frequency mothly,--frequency weekly,-f daily,-f hourly|成功|pass|  
|
||**--days，-d**|具体某天，表示每月或者每周的第几天，可填写多天 。 eg:       `1,5,6,7`    和    `1，5-7`    都表示第1、5、6和7天；,- 只有在    `monthly`    、    `weekly`    才参数有效
- 当频率为    `monthly`    ，取值范围为    `1~31`    ，默认值为    `1-5`  
- 当频率为    `weekly`    ，取值范围为    `1~7`    ，表示星期一到星期天，默认值为    `1-5`  
|当--frequency为weekly时,--days 1,7,8,--days 1-3,当–frequency为monthly时,--days 0,31,32,使用默认值|成功|pass|  
|
||**--start-time，-st**|策略开始时间,- 当频率为    `monthly`    、    `weekly`    和    `daily`    ，格式为    `**:**`    ，表示小时和分钟；默认为    `00:00`  
- 当频率为    `hourly`    ，格式为    `**`    ，表示分钟；默认为    `00`  
|当--frequency为    `monthly`    、    `weekly`    和    `daily时`  ,  `--start-time 00:00`  ,  `--start-time 23:59`  ,  `--start-time 24:59`  ,  `当--frequency为hourly`  ,  `--start-time 00`  ,  `--start-time 59`  ,  `--start-time 60`  |成功|pass|  
|
||**--store-path，-sp**|巡检文件存贮地址，选填项,- 若指定，必须是绝对路径
- 默认保存在OM主机地址：    `$YASDB_HOME/om/${CLUSTER_NAME}/data/patrol_report`  
|--指定,--不指定|成功,若目录不存在，可自动创建|pass|  
|
||-  **-store-days，-sd**|最大保存天数，选填项，默认保存所有,- 仅在策略为    `PERIOD`    下有效
|--指定,--不指定,在timing类型下指定|在TIMING类型下指定忽略不生效，在PERIOD模式下成功|pass|  
|
||**--store-num，-sn**|最大巡检报告数量，选填项，默认保存所有,- 仅在策略为    `PERIOD`    下有效
|--指定,--不指定,在--timing类型下指定|在TIMING类型下指定忽略不生效，在PERIOD模式下成功|pass|  
|
||**--patrol-module**|巡检模块，默认为    `db`    ，填写多个使用    `,`    隔开 (预留参数),- 可选：    `db`    、    `all`    预留(    `host`    、    `log`    、    `awr`    等)
- 支持配置一个巡检模块
|暂不涉及|  
|  
|  
|
||**--db-toml-path**|数据库巡检配置文件地址,- 为空：采用默认数据库巡检配置
- 不为空：生成数据库巡检默认配置文件，并在策略配置文件中指定该文件
|--指定：绝对路径、相对路径,--不指定|成功|pass|  
|
||**--awr-toml-path**|awr巡检配置文件地址(该迭代不不支持，预留参数),- 为空：采用默认awr巡检配置
- 不为空：生成awr巡检默认配置文件，并在策略配置文件中指定该文件
|暂不涉及|  
|  
|  
|
||**--host-toml-path**|主机巡检配置文件地址(该迭代不不支持，预留参数)|暂不涉及|  
|  
|  
|
||**--log-toml-path**|日志巡检配置文件地址(该迭代不不支持，预留参数)|暂不涉及|  
|  
|  
|
|#### patrol strategy add,(添加巡检策略)|**--toml,-t**|巡检策略配置文件|--toml,-t|成功|pass|  
|
|#### patrol strategy apply,(应用巡检策略)|**--cluster, -c**|集群名称|--cluster yashan,-c yashan|成功|pass|  
|
||**--strategy-name, -s**|策略名称|--strategy-name patrol01,-s patrol02|成功|pass|  
|
|patrol strategy cancel,(  取消应用巡检策略  )|**--cluster，-c**|集群名称，必填项|--cluster yashan,-c yashan|成功|pass|  
|
||**--strategy-name，-s**|策略名称，必填项|--strategy-name patrol1,-s patrol2|成功|pass|  
|
|patrol strategy delete,(删除巡检策略)|**--cluster，-c**|集群名称，必填项|--cluster yashan,-c yashan|成功|pass|  
|
||**--strategy-name，-s**|策略名称，必填项|--strategy-name patrol1,-s patrol2|成功|pass|  
|
||**--force,-f**|是否强制删除，,- 被应用了的巡检策略不能直接删除，可以通过    `-f`    强制删除
|--force,-f|成功删除|pass|  
|
|patrol strategy list,(  分页展示巡检策略  )|**--cluster，-c**|集群名称，必填项|--cluster yashan,-c yashan|成功|pass|  
|
||**--size**|一页数据量，默认值为10|-- size 0,-- size 1,-- size 100|成功|pass|  
|
||**--page，-p**|当前分页，默认值为1|--page 1,-p 2|成功|pass|  
|
|patrol report list,(  分页展示巡检报告记录  ),  
    
|**--cluster，-c**|集群名称，必填项|--cluster yashan,-c yashan|成功|pass|  
|
||**--strategy-name，-s**|策略名称，选填项，用于展示指定策略产生的巡检记录|--strategy-name patrol1,-s patrol2|成功|pass|  
|
||**--size**|一页数据量，默认值为10|-- size 0,-- size 1,-- size 100|成功|pass|  
|
||**--page，-p**|当前分页，默认值为1|--page 1,-p 2|成功|pass|  
|
|patrol report get,(  获取巡检报告详细信息  )|**--cluster，-c**|集群名称，必填项|--cluster yashan,-c yashan|成功|pass|  
|
||**--uuid，-u**|巡检报告uuid(唯一标识)，必填项|--uuid,-u|成功|pass|  
|
||**--output，-o**|巡检报告输出路径，相对路径和绝对路径均支持,- 参数    `--output，-o`    为空的时候，直接将报告输出到当前地址，不支持将其打印到屏幕
- 巡检报告文件名称：    `patrolReport_{strategy_name}_{uuid}.json`  
|--output为空,--output相对路径,--output绝对路径|成功|pass|  
|
|patrol report delete,(  删除巡检报告  )|**--cluster，-c**|集群名称，必填项|--cluster yashan,-c yashan|成功|pass|  
|
||**--uuid，-u**|巡检报告uuid|--uuid,-u|成功|pass|  
|
||**--strategy-name, -s**|策略名称,参数  --uuid，-u  和  --strategy-name, -s  互斥，能且只能填写一个|只写--uuid,只写--strategy-name|成功|pass|  
|
|patrol report create,(  立即发起巡检，并生成巡检报告  )|**--cluster，-c**|集群名称，必填项|--cluster yashan,-c yashan|成功|pass|  
|
||**--strategy-name，-s**|巡检策略，选填项|使用已有巡检策略,不使用已有巡检策略|成功|pass|  
|
||**--db-toml**|数据库巡检配置文件,- 为空：采用默认数据库巡检配置
|使用指定巡检配置文件,使用默认配置文件|成功|pass|  
|
||**--output，-o**|巡检报告输出路径|--output为空,--output相对路径,--output绝对路径|成功|pass|  
|
||**--no-download,-n**|是否将报告从    `OM`    下载到本地，默认下载（该参数为true，    `--output`    失效）|指定该参数,不指定该参数|成功|pass|  
|
||**--child，-d**|展示任务以及子任务信息|指定该参数,不指定该参数|成功|pass|  
|
||**--disable**|屏蔽任务进度条展示|指定该参数,不指定该参数|成功|pass|  
|


## **4.2 巡检&巡检策略使用场景**

|使用场景|预期|结果|备注|
|:---|:---|:---|:---|
|使用场景|预期|结果|备注|
|主节点故障后立即发起巡检|报错，显示连接断开|pass|  
|
|备节点故障后立即发起巡检|巡检成功|pass|  
|
|发起巡检后主节点立即故障|巡检成功，报告里无巡检结果|pass|  
|
|发起巡检后备节点立即故障|巡检成功，报告里也显示成功信息|pass|  
|
|同时发起两个巡检|第一个成功，第二个失败|pass|  
|
|磁盘满了|报错|pass|  
|
|有背景业务下发起巡检|巡检成功，报告里也显示成功信息|pass|  
|
|查看巡检信息显示是否正确：,1. 基础信息：数据库状态、归档模式、审计状态    
  2. 健康总览    
  3. 错误日志概览    
  4. CPU内存使用情况    
  5. 主备参数信息、日志同步状态    
  6. 连接数、锁等待、慢SQL等    
  7. 硬解析率、数据池命中率、连接数占用率    
  8. 容量、内存、表空间等|正确显示|pass|  
|
|应用策略后，重启OM，查看策略是否依然有效|依然有效|pass|  
|
|cancel、delete后重启，查看策略是否继续生效|不生效|pass|  
|
|修改巡检项，生成报告查看是否生效|生效|pass|  
|
|巡检项name必须唯一，不唯一报错|add环节报错|pass|  
|
|db  .patrol  .toml文件过大|yasboot报错|  
|  
|
|路径大小写问题|大小写敏感|pass|  
|
|分布式环境dn故障|dn故障不影响巡检|pass|  
|
|分布式环境cn故障|只要有一个cn正常即不影响巡检，全部故障报错|pass|  
|
|分布式环境mn故障|mn故障不影响巡检|pass|  
|
