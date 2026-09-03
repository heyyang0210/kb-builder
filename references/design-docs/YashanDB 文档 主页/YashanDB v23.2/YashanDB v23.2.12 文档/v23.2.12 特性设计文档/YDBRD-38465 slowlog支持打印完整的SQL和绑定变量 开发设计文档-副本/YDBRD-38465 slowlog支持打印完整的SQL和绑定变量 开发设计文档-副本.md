详细设计-YDBRD-38465 : slowlog支持打印完整的SQL和绑定变量

IR链接：YASHAN-3318

SR链接：YDBRD-38466

##   [1. 总述](https://conf.yasdb.com/pages/viewpage.action?pageId=135610619#1-%E6%80%BB%E8%BF%B0)  

###   [1.1 需求来源](https://conf.yasdb.com/pages/viewpage.action?pageId=135610619#11-%E9%9C%80%E6%B1%82%E6%9D%A5%E6%BA%90)  

博时基金有部分慢sql，语句复杂并且有绑定参数，当前sql长度上限2000无法完整打印，导致无法分析慢sql。

部署形态：单机+集群，不支持分布式

###   [1.2 调研文档](https://conf.yasdb.com/pages/viewpage.action?pageId=135610619#12-%E8%B0%83%E7%A0%94%E6%96%87%E6%A1%A3)  

  [https://pingcode.yasdb.com/wiki/pages/67c6cdb2529b5c0231cc59e9](https://pingcode.yasdb.com/wiki/pages/67c6cdb2529b5c0231cc59e9)  

**崖山比mysql多了SLOW_LOG_SQL_MAX_LEN参数，为了兼容性该参数不可去除。**

###   [1.3 需求分析](https://conf.yasdb.com/pages/viewpage.action?pageId=135610619#13-%E9%9C%80%E6%B1%82%E5%88%86%E6%9E%90)  

|属性|场景名称|方案设计|关键技术点|特性是否涉及|
|:---|:---|:---|:---|:---|
|功能|slowlog对超长sql打印完整sql|对SLOW_LOG_SQL_MAX_LEN新增数值0，代表放开SQL长度上限|是|是|
|功能|slowlog对有绑定参数的sql打印绑定变量|从mmon的AnlStmt成员上获取绑定变量进行读取打印，数据放在SQL下一行，变量间以逗号隔开|是|是|
|~~功能~~|~~高并发执行拼接的大SQL，导致SQL快速被刷出缓存，该场景下保证slowlog顺利打印~~|~~对anlcontext增加引用计数，日志写文件/写表结束后释放~~|否|否|
|性能|性能场景1|----|否|否|
|可用性|恢复场景|----|否|否|
|可靠性|故障场景|----|否|否|
|可维可测|DFX功能1|----|否|否|
|安全|安全场景1|----|否|否|
|易用性|----|----|否|否|
|可修改性|----|----|否|否|
|兼容性|----|----|否|否|
|周边配合|权限|----|否|否|
|周边配合|审计|----|否|否|
|周边配合|导入导出工具|----|否|否|


###   [1.4 数据字典](https://conf.yasdb.com/pages/viewpage.action?pageId=135610619#14-%E6%95%B0%E6%8D%AE%E5%AD%97%E5%85%B8)  

**描述本篇文档中特性的术语集**

|术语|描述|借鉴业界|参考|
|:---|:---|:---|:---|
|术语1|描述|是|业界资料链接|
|术语2|描述|无|原创技术，参考技术设计链接|


###   [1.5 开源依赖](https://conf.yasdb.com/pages/viewpage.action?pageId=135610619#15-%E5%BC%80%E6%BA%90%E4%BE%9D%E8%B5%96)  

无

##   [2. 接口](https://conf.yasdb.com/pages/viewpage.action?pageId=135610619#2-%E6%8E%A5%E5%8F%A3)  

**列出从SR层级对外可以感知的特性，对应提供的接口、配置参数、API等。**   SR对外呈现的接口，如一个SQL语法（含多个分支），一个高级包（含多个子函数、过程），SQL语法分支、函数功能、高级包功能、系统视图与动态视图（不包含用户自定义视图）、配置参数、驱动接口、用户可感知的错误码、告警、日志 等

|接口|接口表现|接口说明|是否涉及|
|:---|:---|:---|:---|
|SQL语法|语法分支1描述|----|否|
|SQL语法|语法分支2描述|----|否|
|函数|参数/返回值描述|----|否|
|高级包|高级包子对象描述|----|否|
|系统视图|视图域段描述|----|否|
|动态视图|视图域段描述|----|否|
|系统表|SLOW_LOG$新增SQL_FULLTEXT和SQL_PARAMS字段，类型为CLOB，可为空|sqltext均会脱敏。,当SLOW_LOG_SQL_MAX_LEN=0，SQL_TEXT字段以2000为上限截断，SQL_FULLTEXT打印完整SQL,当SLOW_LOG_SQL_MAX_LEN!=0，SQL_TEXT字段以SLOW_LOG_SQL_MAX_LEN为上限截断，SQL_FULLTEXT为空,绑定参数字符串格式：,PARAMS 1:1,2,'123',PARAMS 2:2,2,'456',若绑定参数总长度超过64K，以参数顺序依次转为text，超过的部分丢弃|是|
|配置参数|SLOW_LOG_SQL_MAX_LEN新增数值0，代表放开SQL长度上限,新增参数SLOW_LOG_PARAM_MAX_LEN代表单个绑定参数占用的最大字符串长度,|SLOW_LOG_PARAM_MAX_LEN默认2000，范围[20,32000]，修改立即生效、非会话级、非只读|是|
|驱动接口|驱动对外提供接口描述|----|否|
|错误码|错误码、ACTION描述|----|否|
|告警|告警描述|----|否|
|日志|慢日志中记录绑定参数数值，配置SLOW_LOG_SQL_MAX_LEN为0时打印完整SQL，非0时以SLOW_LOG_SQL_MAX_LEN为SQL字符串长度上限|----|是|


##   [3. 规格与约束](https://conf.yasdb.com/pages/viewpage.action?pageId=135610619#3-%E8%A7%84%E6%A0%BC%E4%B8%8E%E7%BA%A6%E6%9D%9F)  

SLOW_LOG_SQL_MAX_LEN为0，代表放开SQL长度上限

##   [4. 特性](https://conf.yasdb.com/pages/viewpage.action?pageId=135610619#4-%E7%89%B9%E6%80%A7)  

###   [4.1 特性设计](https://conf.yasdb.com/pages/viewpage.action?pageId=135610619#41-%E7%89%B9%E6%80%A7%E8%AE%BE%E8%AE%A1)  -放开字符串长度限制

修改SLOW_LOG_SQL_MAX_LEN范围，原范围[20,2000]，增加一个0表示无限制。

慢日志任务入队时保存sql的AnlContext地址并增加refCount，在写日志/写表阶段由anlGetDesnsitizeSql获取脱敏SQL，判断AnlAttr.slowLogSqlMaxLen是否为0，若为0打印完整SQL，若非0按该参数打印SQL。

改写anlGetDesnsitizeSql入参。该函数从large pool分配空间2MB，数据落盘后anlReleaseDesnsitizeSql释放空间，解除AnlContext引用。

**打印到日志：**

anlRecordSlowlog里调用anlGetDesnsitizeSql，获取的已是codtext格式的完整字符串，只需在传递和打印部分放开buf上限。

**保存到系统表：**

SLOW_LOG$添加SQL_FULLTEXT字段，字段可为空，CLOB类型。

如果配置为0，SQL_TEXT仍保留数据，上限2000

数据脱敏：anlGetDesnsitizeSql里数据已完成脱敏，与之前规格一致

|SLOW_LOG_SQL_MAX_LEN|SQL_TEXT|SQL_FULLTEXT|
|---|---|---|
|0|上限2000截断|打印完整sql|
|非0|上限SLOW_LOG_SQL_MAX_LEN截断|空|


###   [4.2 特性功能点2](https://conf.yasdb.com/pages/viewpage.action?pageId=135610619#42-%E7%89%B9%E6%80%A7%E5%8A%9F%E8%83%BD%E7%82%B92)  -绑定参数打印

在SQL的行后新增行，若是批量绑定，只打印最后一行。

格式如下：

```
# TIME: 2025-03-06 15:35:25.787
# USER_HOST: SYS@127.0.0.1
# DB_NAME: test
# COST_EXECUTE_TIME: 0.012370
# COST_OPTIMIZE_TIME: 0.000826
# ROWS_SENT: 2
# SQL_ID: 2pf6ky1ydupha
SQL: insert into t1 values(?,?,?)
BindParameters: 1,2,123str
```

单个绑定参数长度上限受到SLOW_LOG_PARAM_MAX_LEN控制，参数字符串总上限64K

在任务入队时直接从paramgroup读取Variant数据，转换拼接为要落盘的字符串

若绑定参数总长度超过64K，以参数顺序依次转为text，超过的部分丢弃，字符串尾为...

若单个绑定参数长度超过SLOW_LOG_PARAM_MAX_LEN，超过的部分丢弃，下一个逗号前字符串尾为...，省略号占SLOW_LOG_PARAM_MAX_LEN长度

举例：SLOW_LOG_PARAM_MAX_LEN=9

1,2,123456...,123456...,123456...

若单个参数字符串包含英文逗号，该参数会被英文双引号包裹，双引号不占SLOW_LOG_PARAM_MAX_LEN长度

举例：SLOW_LOG_PARAM_MAX_LEN=9

1,2,"123,456,7"

以上规则处理顺序：

先计算总长度，把超过部分以省略号替代，再检查替代后的字符串，若有逗号加上双引号



写表：

SLOW_LOG$添加SQL_PARAMS字段，字段可为空，CLOB类型。

调用rowAddBytes把lob插入到SQL_PARAMS

写日志：

把lob转换为text，aniSlowLogWrite写到日志文件







###   [~~4.3 特性功能点3-确保SQL不被刷出缓存~~](https://conf.yasdb.com/pages/viewpage.action?pageId=135610619#43-%E7%89%B9%E6%80%A7%E6%80%A7%E8%83%BD%E7%82%B91)  

缓存通过AnlPool管理，由池里的AnlContext->refCount计数保护。refCount不为0的AnlContext不会被释放，可以查到SQL语句；refCount为0的AnlContext可能被刷出缓存。

在mmonSlowLogTaskEnQueue阶段mmonTaskDeepCopy后对AnlContext->refCount自增，确保写日志任务入队列；在mmonConsumeLogTask调用slowlogDeQueue之前对AnlContext->refCount自减。



##   [5. Testcases（自测用例）](https://conf.yasdb.com/pages/viewpage.action?pageId=135610619#5-testcases%E8%87%AA%E6%B5%8B%E7%94%A8%E4%BE%8B)  

日志输出对象：TABLE/FILE

绑定参数：有/无绑定参数、绑定参数覆盖所有支持的数据类型、绑定参数字符串长度上限

设置share_pool_size为最小值，高并发执行拼接的大SQL

执行需要脱敏的语句，检查表和日志的记录是否脱敏



##   [6.资料设计章节](https://conf.yasdb.com/pages/viewpage.action?pageId=135610619#6%E8%B5%84%E6%96%99%E8%AE%BE%E8%AE%A1%E7%AB%A0%E8%8A%82)  

修改配置参数SLOW_LOG_SQL_MAX_LEN的文档，范围参考MAX_WORKERS；修改slow_log$说明。

修改慢日志管理文档。

##   [7.未来规划](https://conf.yasdb.com/pages/viewpage.action?pageId=135610619#7%E6%9C%AA%E6%9D%A5%E8%A7%84%E5%88%92)  

无

## 8.待定细节

1.是否可以用refCount引用保护AnlContext，在落盘阶段再申请large pool空间转换为脱敏text

2.在任务入队阶段把绑定参数转换拼接，此处每个任务最大申请64K，这部分空间从mex还是vm申请

3.若动态申请空间失败，是否要在日志中提示慢sql保存失败