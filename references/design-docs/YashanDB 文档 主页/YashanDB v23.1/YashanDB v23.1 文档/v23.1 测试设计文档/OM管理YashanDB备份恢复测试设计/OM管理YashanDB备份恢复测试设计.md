Created by 施新华, last modified on 十一月 14, 2023

# **1、概述**

**本文档主要是使用OM管理YashanDB的备份恢复**

**设计文档：**

**SR: **

  [YDBRD-13303](https://jira.yasdb.com/browse/YDBRD-13303?src=confmacro)    **-**  **【OM】支持备份策略管理和配置**  **完成**

  [YDBRD-13304](https://jira.yasdb.com/browse/YDBRD-13304?src=confmacro)    **-**  **【OM】OM备份执行和恢复**  **完成**

  [YDBRD-13305](https://jira.yasdb.com/browse/YDBRD-13305?src=confmacro)    **-**  **【OM】备份流水查看和详情展示**  **完成**

  [YDBRD-13248](https://jira.yasdb.com/browse/YDBRD-13248?src=confmacro)    **-**  **【OM】备份策略支持分布式数据库**  **完成**

  


# **2、需求分析**

## **2.1 需求描述**

**om支持YashanDB备份恢复的管理**

## **2.2 功能特性**

**yasboot新增命令行接口**

|命令|说明|
|---|---|
|backup strategy config agen|生成备份策略配置文件|
|backup strategy add|新增备份策略|
|backup strategy apply|应用备份策略|
|backup strategy cancel|取消应用备份策略|
|backup strategy delete|删除备份策略|
|backup strategy list|展示备份策略列表|
|backup strategy show|展示备份策略详细信息|


**其他备份命令**

|命令|说明|
|---|---|
|backup create|创建备份|
|backup delete|删除备份|
|backup restore|恢复备份|
|backup list|查询备份列表|


## **2.3 特性约束**

**1、备份策略**

- 应用对象
    - 单机集群的节点 ：备份单个节点 (主节点或者备节点)
    - 分布式集群：备份集群中所有主节点
- 策略类型：
    -   `PERIOD`    ：周期性策略，可执行多次
    -   `TIMING`    ：定时备份策略，执行一次
    -   `IMMEDIATE`    ：立即备份策略，执行一次
- 限制
    -   `PERIOD`    、    `TIMING`    类型的策略最多被一个节点或者集群应用一次
    -   `IMMEDIATE`    类型的策略可以被应用多次
    -   `PERIOD`    类型策略下发的备份任务的最小间隔时间为1小时


**2、数据库备份与恢复**

- 备份和恢复操作全部使用工具    `yasrman`    完成
- 限制
    - 备份
        - 数据库必须是    `open`    状态，且为归档模式
        - 最多执行1000次连续的    `LEVEL 1`    增量备份
        - 只支持在节点主机存贮备份文件
    - 恢复
        - 数据库必须是    `nomount`    状态，且旧的数据文件全部删除
    - 增量备份恢复必须保证增量备份集完整，否则恢复失败
        - 不同的类型节点不支持定向恢复
    - yasrman
        - 对于同一个数据库最多同时执行一个备份或者恢复命令
    - 并行度取值范围    `[1,8]`  
        - 若指定备份地址，该备份文件夹必须不存在
        - 分布式多个节点在同一台主机，指定的备份目录必须是相对路径 (各自节点$YASDB_DATA/backup目录下)
    - 分布式备份文件无法存贮到工具端(client 端)，只能存贮在数据库主机端(service 端)


# **3、测试设计方法**

### 3.1 特性关联领域分析：

1. 功能性：语法、结合业务场景
1. 部署形态：单机（一主两备）同机部署、跨机部署、打开自选主、1主32备
1. 测试环境：linux
1. 可靠性、异常：异常环境
1. 易用性：使用过程是否简单易上手，报错是否明确
1. 数据量：包括少量和大量(>10G)，大量数据时备份恢复的性能必须在合理范围内
1. 表类型：heap、lsc、tac、分区表


# **4、详细测试设计**

## **4.1 语法验证**

|命令|参数|说明|测试策略|预期|结果|备注|
|---|---|---|---|---|---|---|
|yasboot backup     strategy config gen,（生成备份策略配置文件）|**--cluster，-c**|集群名称，必填项|--cluster,-c|成功|pass|  
|
|  
|**--strategy-name, -s**|策略名称，必填项|--strategy-name, -s|成功|pass|  
|
|  
|**--strategy-type, -t**|策略类型，默认为  PERIOD  ，可选值(不区分大小写)有:,-   `PERIOD`    ：周期性策略，可执行多次
-   `TIMING`    ：定时备份策略，执行一次
-   `IMMEDIATE`    ：立即备份策略，执行一次
|--strategy-type period,-t period,--strategy-type timing,-t timing,--strategy-type immediate,-t immediate|成功|pass|  
|
|  
|**--backup-type,-bt**|备份类型，默认为    `FULL`    ，可选值(不区分大小写)有：,-   `FULL`    ：全量备份
- **INCREMENTAL**  **：普通增量备份**
- **CUMULATIVE**  **：累计增量备份**
|--backup-type full,--backup-type incremental,--backup-type cumulative|成功|pass|  
|
|  
|**--section-size,-ss**|文件分片的大小，范围    `[128M，32T]`    ，默认为系统自动计算的最优值|--section-size 127M,--section-size 128M,--section-size 32T,--section-size 32.1T|正常范围内执行成功,超出范围外失败|pass|  
|
|  
|**--compression,-cm**|压缩算法和压缩级别(使用冒号分割，不区分大小写)，默认为    `ZSTD:LOW`  ,- 压缩算法：    `ZSTD`    、    `LZ4`  
- 压缩级别：    `HIGH`    、    `MEDIUM`    、    `LOW`  
|--compression zstd:low,--compression zstd:medium,--compression zstd:high,--compression lz4:low,--compression lz4:medium,--compression lz4:high|成功|pass|  
|
|  
|**--encryption,-e**|加密算法和密码(使用冒号分割，加密算法不区分大小写)。eg:       `AES128:password_123`  ,- 加密算法：    `AES128`    、    `AES192`    、    `AES256`    、    `SM4`  
|--encryption aes128:OOoo!@34,--encryption aes192:OOoo!@34,--encryption aes256:OOoo!@34,--encryption sm4:OOoo!@34|成功|pass|  
|
|  
|**--parallelism,-p**|并行度，选填项，默认为2，取值范围    `[1,8]`  |--parallelism -2,--parallelism 0,--parallelism 1,--parallelism 8,--parallelism 9|正常范围内执行成功,超出范围外失败|pass|  
|
|  
|**--cron-expression,-ce**|  `cron`    表达式 (设置了该参数，下面三个参数失效),- 格式：    `* * * * *`    ，分别表示：    `分钟、小时、天、月、周`  
|  
|  
|pass|  
|
|  
|**--frequency，-f**|备份频率，默认为    `daily`    ，可选值如下：,-   `monthly`    ：每月
-   `weekly`    ：每周
-   `daily`    ：每天
-   `hourly`    ：每小时
|--frequency mothly,--frequency weekly,-f daily,-f hourly,**修改操作系统时间测试**|成功|pass|  
|
|  
|**--days**|具体某天，表示每月或者每周的第几天，可填写多天 。 eg:       `1,5,6,7`    和    `1，5-7`    都表示第1、5、6和7天；,- 只有在    `monthly`    、    `weekly`    才参数有效
- 当频率为    `monthly`    ，取值范围为    `1~31`  
- 当频率为    `weekly`    ，取值范围为    `1-7`    ，表示星期一到星期天
|当--frequency为weekly时,--days 1,7,8,--days 1-3,当–frequency为monthly时,--days 0,31,32,使用默认值|成功|pass|  
|
|  
|**--start-time,-st**|策略开始时间,- 当频率为    `monthly`    、    `weekly`    和    `daily`    ，格式为    `**:**`    ，表示小时和分钟；默认为    `00:00`  
- 当频率为    `hourly`    ，格式为    `**`    ，表示分钟；默认为    `0`  
|当--frequency为    `monthly`    、    `weekly`    和    `daily时`  ,  `--start-time 00:00`  ,  `--start-time 23:59`  ,  `--start-time 24:59`  ,  `当--frequency为hourly`  ,  `--start-time 00`  ,  `--start-time 59`  ,  `--start-time 60`  |成功|pass|  
|
|  
|**--store-path,-sp**|备份文件存贮地址，选填项|相对路径----报错,绝对路径,目录名称的大小写,目录名称的长度,权限问题|成功|pass|  
|
|  
|-  **-store-days,-sd**|最大保存天数，仅在全量备份    `FULL`    下有效|当--backup-type为full时,-  -store-days 10,**默认值**|成功|pass|  
|
|  
|**--store-num,-sn**|最大备份数量，仅在全量备份    `FULL`    下有效|当--backup-type为full时,**--store-num 10**,**默认值**|成功|pass|  
|
|  
|**--config-path**|配置文件输出地址，默认为当前地址|相对路径--当前路径,绝对路径|成功|pass|  
|
|yasboot backup strategy     add,（新增备份策略）|**--toml，-t**|备份策略配置文件，必填项,备注：解析toml配置文件中的备份策略，并将其存贮到sqlite3数据库中|--toml，-t|成功|pass|  
|
|yasboot backup     strategy     apply,（应用备份策略）|**--cluster，-c**|集群名称，必填项|--cluster，-c|成功|pass|  
|
|  
|**--strategy-name，-s**|策略名称，必填项|--strategy-name，-s|成功|pass|  
|
|  
|**--node-id，-n**|节点id,- 单机：必填项
- 分布式：该参数无效，分布式备份整个集群
|--node-id 主节点 1-1,-n 备节点|成功|pass|  
|
|yasboot   backup     strategy     cancel,（取消备份策略）|**--cluster，-c**|集群名称，必填项|--cluster，-c|成功|pass|  
|
|  
|**--strategy-name，-s**|策略名称，必填项|--strategy-name，-s|成功|pass|  
|
|  
|**--node-id，-n**|节点id|--node-id，-n,主节点、备节点|成功|pass|  
|
|yasboot   backup     strategy     delete,（删除备份策略）|**--cluster，-c**|集群名称，必填项|--cluster，-c|成功|pass|  
|
|  
|**--strategy-name，-s**|策略名称，必填项|--strategy-name，-s,  
|不加-f删除应用的策略报错|pass|  
|
|  
|**--force，-f**|强制删除，选填项，默认为    `false`  ,- 若策略已经被应用，需要强制才能删除
|--force，-f|成功|pass|  
|
|yasboot   backup     strategy     list,（分页展示备份策略）|**--cluster，-c**|集群名称，必填项|--cluster，-c|成功|pass|  
|
|  
|**--detail，-d**|详细信息，选填项|--detail，-d|成功|pass|  
|
|  
|**--size，-s**|一页数据量，默认值为10|--size 1,-s 100|成功|pass|  
|
|  
|**--page，-p**|当前分页，默认值为1|--page 2,-p 10|成功|pass|  
|
|  
|**--sort，-S**|排序字段，默认为    `created_at`  |--sort 其他列,-S 其他列|成功|pass|  
|
|  
|**--order，-o**|排序，默认为    `dasc`    ，可选值有：    `dasc`    和    `asc`  |--order asc,-o desc|成功|pass|  
|
|  
|**--search**|通过列搜索；格式为    `rowName:searchValue`  |仅支持4个列，例：,strategy_name=backup35,backup_type=FULL,strategy_type=immediate,cron_expression='0 * * * ?',其他列报错|其他列报错|pass|  
|
|yasboot   backup     strategy     show,（展示备份策略的执行信息）|**--cluster，-c**|集群名称，必填项|--cluster，-c|成功|pass|  
|
|  
|**--strategy-name，-s**|策略的名称，必填项|--strategy-name，-s|成功|pass|  
|
|  
|||||||
|  
|||||||
|  
|||||||
|yasboot   backup     create,（创建备份）|**--cluster，-c**|集群名称，必填项|--cluster，-c|成功|pass|  
|
|  
|**--node-id，-n**|节点id,- 单机：必填项
- 分布式：该参数无效，分布式备份整个集群
|--node-id，-n,主节点,备节点|成功|pass|  
|
|  
|**--backup-type**|备份类型，默认为    `FULL`    ，选填项，可选值(不区分大小写)有：,-   `FULL`    ：全量备份
-   `INCREMENTAL`    ：普通增量备份
-   `CUMULATIVE`    ：累计增量备份
|--backup-type full,--backup-type incremental,--backup-type cumulative|成功|pass|  
|
|  
|**--backup-base**|当备份类型是    `INCREMENTAL`    、    `CUMULATIVE`    时，是否执行level 0的基准备份|添加参数,不添加|成功|pass|  
|
|  
|**--section-size,-ss**|文件分片的大小，范围    `[128M，32T]`    ，可选参数，默认为系统自动计算的最优值|--section-size 127M,--section-size 128M,--section-size 32T,--section-size 32.1T|成功|pass|  
|
|  
|**--compression,-cm**|压缩算法和压缩级别(使用冒号分割，不区分大小写)，默认为    `ZSTD:LOW`  ,- 压缩算法：    `ZSTD`    、    `LZ4`  
- 压缩级别：    `HIGH`    、    `MEDIUM`    、    `LOW`  
|--compression zstd:low,--compression zstd:medium,--compression zstd:high,--compression lz4:low,--compression lz4:medium,--compression lz4:high|成功|pass|  
|
|  
|**--encryption,-e**|加密算法和密码(使用冒号分割)，默认不加密,- 加密算法：    `AES128`    、    `AES192`    、    `AES256`    、    `SM4`  
|--encryption aes128:OOoo!@34,--encryption aes192:OOoo!@34,--encryption aes256:OOoo!@34,--encryption sm4:OOoo!@34,不添加加密参数|成功|pass|  
|
|  
|**--parallelism,-p**|并行度，默认为2，选填项，取值范围    `[1,8]`  |--parallelism 1,--parallelism 8,--parallelism 9|正常范围内执行成功,超出范围外失败|pass|  
|
|  
|**--store-path,-sp**|存贮地址，选填项|默认路径,指定路径|成功|pass|  
|
|yasboot   backup     delete,（删除备份）|**--cluster，-c**|集群名称，必填项|--cluster，-c|成功|pass|  
|
|  
|**--uuid，-u**|备份uuid，必填项|--backup-id，-b|成功|pass|  
|
|  
|**--force，-f**|是否强制删除，默认为false，选填项|添加参数,不添加参数|  
|pass|  
|
|yasboot   backup     list,（展示备份列表）|**--cluster，-c**|集群名称，必填项|--cluster，-c|成功|pass|  
|
|  
|**--detail，-d**|详细信息，选填项|添加参数,不添加参数|成功|pass|  
|
|  
|**--node-id，-n**|节点id，选填项，若为空则查询所有的节点，分布式没有该列|--node-id，-n|成功|pass|  
|
|  
|**--size，-s**|一页数据量，默认值为10|--size 1,-s 100|成功|pass|  
|
|  
|**--page，-p**|当前分页，默认值为1|--page 2,-p 10|成功|pass|  
|
|  
|**--sort，-S**|排序字段，默认为    `created_at`  |--sort 其他列,-S 其他列|成功|pass|  
|
|  
|**--order，-o**|排序，默认为    `dasc`    ，可选值有：    `dasc`    和    `asc`  |--order asc,-o desc|成功|pass|  
|
|  
|**--search**|通过列搜索；格式为    `rowName=searchValue`  |strategy_name=backup35,backup_type=FULL,strategy_type=immediate,cron_expression='0 * * * ?'|成功|pass|  
|
|yasboot   backup     get,（展示备份详细信息）|**--cluater -c**|集群名称，必填项|--cluater -c|成功|pass|  
|
|  
|**--uuid，-u**|备份集的UUID，必填项|--uuid，-u|成功|pass|  
|
|yasboot   backup     restore,（恢复）|**--cluster，-c**|集群名称，必填项|--cluster，-c|成功|pass|  
|
|  
|**--uuid，-u**|备份集uuid，必填项|--uuid，-u|成功|pass|  
|
|  
|**--node-id，-n**|恢复的节点，默认为备份时的节点 (备份集为节点时才有效)|--node-id，-n,主节点id,备节点id|成功|pass|  
|
|  
|**--parallelism,-p**|并行度，默认为2，选填项，取值范围    `[1,8]`  |--parallelism 0,--parallelism 1,--parallelism 8,--parallelism 9|超过范围报错|pass|  
|
|  
|**--sys-password，-sp**|sys用户密码 (恢复备份属于高危操作，需要密码确认)|密码正确,密码错误|密码错误报错|pass|  
|
|  
|**--decryption-password，-dp**|备份文件解密密码，也就是备份加密密码|密码正确,密码错误|密码错误报错|pass|  
|


## **4.2 备份使用场景**

|使用场景|预期|结果|备注|
|---|---|---|---|
|**使用备份策略备份**||||
|数据库非归档模式|报错|pass|  
|
|数据库非open模式|报错|pass|  
|
|无背景业务对主节点应用备份策略|成功|pass|  
|
|无背景业务对备节点应用备份策略|成功|pass|  
|
|对主节点和备节点应用同一个备份策略|先应用的成功，后应用的拦截报错|pass|  
|
|同时对主节点和备节点使用立即备份策略|下发成功，有一个失败|pass|  
|
|同时对同一个节点使用立即备份策略|第一个成功，第二个下发失败|pass|  
|
|删除未应用备份策略|成功删除|pass|  
|
|删除已应用备份策略|若是立即备份策略，可删除成功，其他的删除失败，加-f成功删除|pass|  
|
|备节点全部异常，主节点执行备份|成功|  
|  
|
|有DDL/DML背景业务执行备份策略|成功|pass|  
|
|同一个节点使用多个备份策略|应用备份策略成功，备份任务执行重叠，任务下发失败|pass|  
|
|同一个备份策略备份未完成，下次备份已开始|未完成任务再次执行，任务下发失败|pass|  
|
|备份数超过  **-**  -store-num指定的最大保存数量|最早的备份会被删除|pass|  
|
|**使用备份命令备份**||||
|主节点与备节同时执行备份操作|先执行的成功，后执行的报错|pass|  
|
|有大量DML/DDL背景业务，执行备份|成功|pass|  
|
|指定的备份路径不存在|自动创建后再备份|pass|  
|
|指定的备份路径非空|成功|pass|  
|
|备份时，磁盘空间不足|备份报错|pass|  
|
|执行超过1000次level 1的普通增量备份|超过后备份失败|  
|  
|
|删除某个累加增量备份|会提示删除了后备份将会不完整，无法执行恢复操作|pass|  
|
|备份过程中主备切换（主降备，备升主）|备份报错退出|pass|  
|
|备份过程中节点故障（kill、shutdown、yasboot cluster stop）|报错失败|pass|  
|
|启动后再次备份|成功|pass|  
|
|备份后，查看v$logfile，redo日志是否切换|不切换|pass|  
|


## **4.3 恢复使用场景**

|使用场景|预期|结果|备注|
|---|---|---|---|
|控制文件损坏或者丢失，执行恢复|成功恢复|pass|  
|
|系统关键数据文件损坏或者丢失，执行恢复|成功恢复|pass|  
|
|在线日志文件损坏或者丢失，执行恢复|成功恢复|pass|  
|
|表被truncate、drop、delete或update，执行恢复|成功恢复|pass|  
|
|执行恢复时sys密码错误|报错|pass|  
|
|执行恢复时加密备份的解密密码错误|报错|pass|  
|
|使用主节点的备份集恢复备节点|成功恢复|pass|  
|
|使用备节点的备份集恢复主节点|成功恢复|pass|  
|
|备份后手动执行主备切换后，执行恢复操作|成功恢复|pass|  
|
|主备节点同时执行恢复操作|先执行的成功，后执行的失败|pass|  
|
|节点故障后执行恢复|成功恢复|pass|  
|
|恢复过程中节点故障|成功恢复|pass|恢复过程中无法kill制造故障|
|故障恢复后再次恢复|恢复成功|pass|  
|
|备份后再添加tablespace,dbfiles,再次恢复|查看新添加的表空间数据文件是否删除|新添加的tablespace,dbfiles被删除，pass|  
|
|恢复后，查看v$logfile，redo日志是否切换|不切换|pass|  
|
