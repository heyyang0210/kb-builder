# 1.   **概述**

   当前生成快照时，wrh$_sqltext和wrh$_sqlstat会插入系统视图v$sqlarea的全部数据，如果该视图有几十万行sql，则每次生成快照都会写进去导致sysaux空间扩展较快。

*SR链接：*  [https://pingcode.yasdb.com/pjm/items/67186a42e489dd0868fccb2f?](https://pingcode.yasdb.com/pjm/items/67186a42e489dd0868fccb2f?)  

开发设计文档：  [(1865) AWR快照存储优化 | 知识管理 - PingCode](https://pingcode.yasdb.com/wiki/spaces/QINQIUTING/pages/673c434f728206efb9323af3)  



# 2.   **需求分析**

## **2.1. 需求特性**

a.   支持设置top sql的数量：通过dbms_awr.  modify_snapshot_settings设置topnsql。

b.   快照存储优化：通过设置的topnsql控制  插入到wrh$_sqlstat、wrh$_sqltext的sql数量。

c.   记录的top sql为和上一次快照时间间隔内有变化的sql：  context再记录一组last snap stat，查询x$sqlarea时_delta值为统计项当前值 - last snap记录值。



**特性功能实现：**

1.通过exec dbms_workload_repository.modify_snapshot_settings(topnsql=>30);设置每次创建快照时收集到系统表的每个sql标准（elapsed_time、cpu_time、parse_calls、sharable_mem）的sql数量；

2.收集到系统表的sql是和上一次快照之间有增量变化的top sql；

3.增量变化在x$sqlarea增加一组_delta值展示，通过在context->stat上记录每个统计项的当前值和last snap值，视图的_delta值即为统计项的当前值 - last snap值。

4.创建快照时，在收集完快照信息之后更新last snap stat。



**设置topnsql:**

1.WRM$_WR_CONTROL增加topnsql字段（number类型）；

2.modify_snapshot_settings存储过程增加入参topnsql IN VARCHAR2 DEFAULT NULL；

3.入参topnsql为N时，直接更新WRM$_WR_CONTROL的topnsql；入参topnsql为DEFAULT时，更新WRM$_WR_CONTROL的topnsql为默认值30；入参topnsql为MAXIMUM时，更新WRM$_WR_CONTROL的topnsql为2000000001。

topnsql：允许用户指定以下值：（DEFAULT、MAXIMUM、N）。N是生成快照时每个SQL标准刷新的Top SQL数量，可指定范围为[30,50000]；指定DEFAULT会使系统恢复默认行为，即TOP 30；指定MAXIMUM会获取视图中的全部SQL。该参数默认为NULL，表示保持当前设置。

## 2.2.   **约束**

无。



# 3.   **测试策略**

对AWR快照存储优化和支持设置TOP SQL的数量进行功能测试为主，性能测试部分验证topnsql在同等业务下，对比设置topnsql前后、不同值的性能。



# 4.   **测试设计方法**

本文测试设计对象为AWR快照存储优化和支持设置TOP SQL的数量：测试用例采用边界值、等价类及场景法组合进行设计。



# 5.   **详细测试设计**

AWR快照存储优化和支持设置TOP SQL的数量测试用例场景覆盖如下：

|测试类型|场景语句|预期结果|备注|
|---|---|---|---|
|功能测试：,正常的输入值（如设置为 100 行）。,边界值（例如 29 行、最大值、50001 行）。,错误的输入值（例如负数、非整数值）。|设置有效的topnsql值：,目标：验证 topnsql => 100 设置是否正确应用。,步骤：,执行 exec dbms_workload_repository.modify_snapshot_settings(topnsql => 100);,查看 AWR 报告，确认 topnsql 输出的 SQL 数量是否为 100 行。select TOPNSQL from WRM$_WR_CONTROL;|AWR 报告、select TOPNSQL from WRM$_WR_CONTROL;中显示的 Top SQL 数量为 100 行，符合设置。,观察WRH$_SQLSTAT、WRH$_SQLTEXT存储的sql数量符合预期。||
||设置topnsql 为49999：,目标：验证设置 topnsql => 50000 是否能正确应用。,步骤：,执行 exec dbms_workload_repository.modify_snapshot_settings(topnsql => 49999 );,查看 AWR 报告，确认 topnsql 输出的 SQL 数量是否为 49999行。select TOPNSQL from WRM$_WR_CONTROL;|AWR 报告、select TOPNSQL from WRM$_WR_CONTROL;中显示的 Top SQL 数量为 49999 行。,观察WRH$_SQLSTAT、WRH$_SQLTEXT存储的sql数量符合预期。||
||设置 topnsql 为 50000 ：,目标：验证设置 topnsql => 50000 是否能正确应用。,步骤：,执行 exec dbms_workload_repository.modify_snapshot_settings(topnsql => 50000 );,查看 AWR 报告，确认 topnsql 输出的 SQL 数量是否为 50000 行。select TOPNSQL from WRM$_WR_CONTROL;|AWR 报告、select TOPNSQL from WRM$_WR_CONTROL;中显示的 Top SQL 数量为 50000 行。,观察WRH$_SQLSTAT、WRH$_SQLTEXT存储的sql数量符合预期。||
||设置为空：,执行 exec dbms_workload_repository.modify_snapshot_settings(topnsql => ' ');,查看 AWR 报告，确认 topnsql 输出的 SQL 数量是否为 30行。select TOPNSQL from WRM$_WR_CONTROL;|AWR 报告、select TOPNSQL from WRM$_WR_CONTROL;中显示的 Top SQL 数量为 30 行。,观察WRH$_SQLSTAT、WRH$_SQLTEXT存储的sql数量符合预期。||
||设置 topnsql 为极大值：,目标：验证设置一个较大的 topnsql 值时是否能正常应用。,步骤：,执行 exec dbms_workload_repository.modify_snapshot_settings(topnsql => 'MAXIMUM');,查看 AWR 报告，确认 topnsql 输出的 SQL 数量是否为 2000000001行。select TOPNSQL from WRM$_WR_CONTROL;|AWR 报告、select TOPNSQL from WRM$_WR_CONTROL;中显示的 Top SQL 数量为 2000000001行。,观察WRH$_SQLSTAT、WRH$_SQLTEXT存储的sql数量符合预期。||
||设置为default：,执行 exec dbms_workload_repository.modify_snapshot_settings(topnsql => 'DEFAULT');,查看 AWR 报告，确认 topnsql 输出的 SQL 数量是否为 30行。select TOPNSQL from WRM$_WR_CONTROL;|AWR 报告、select TOPNSQL from WRM$_WR_CONTROL;中显示的 Top SQL 数量为 30 行。,观察WRH$_SQLSTAT、WRH$_SQLTEXT存储的sql数量符合预期。||
||设置为30：,执行 exec dbms_workload_repository.modify_snapshot_settings(topnsql => 30);,查看 AWR 报告，确认 topnsql 输出的 SQL 数量是否为 30行。select TOPNSQL from WRM$_WR_CONTROL;|AWR 报告、select TOPNSQL from WRM$_WR_CONTROL;中显示的 Top SQL 数量为 30 行。,观察WRH$_SQLSTAT、WRH$_SQLTEXT存储的sql数量符合预期。||
||创建快照：,执行 exec sys.dbms_awr.create_snapshot();,业务执行前后、设置topnsql前后创建快照。,复杂sql业务、tpcc业务等。|快照创建成功，高级包dbms_awr_extra功能正常，last snap stat相应正常变化。||
|||||
||设置 topnsql 为 50001 ：,目标：验证设置 topnsql => 50001 是否能正确应用。,步骤：,执行 exec dbms_workload_repository.modify_snapshot_settings(topnsql => 50001 );|报错，参数值不在设置范围内。||
||设置 topnsql 为 0：,目标：验证设置 topnsql => 0 是否无输出 SQL。,步骤：,执行 exec dbms_workload_repository.modify_snapshot_settings(topnsql => 0);|报错，参数值不在设置范围内。||
||设置 topnsql 为 29：,目标：验证设置 topnsql => 29 是否能正确应用。,步骤：,执行 exec dbms_workload_repository.modify_snapshot_settings(topnsql => 29);|报错，参数值不在设置范围内。||
||设置无效的 topnsql 值（负数）：,目标：验证设置一个负值时是否会返回错误。,步骤：,执行 exec dbms_workload_repository.modify_snapshot_settings(topnsql => -10);|数据库返回错误，提示 topnsql 参数无效。||
||设置非整数值：,目标：验证设置一个非整数值时是否会返回错误。,步骤：,执行 exec dbms_workload_repository.modify_snapshot_settings(topnsql => 'abc');|数据库返回错误，提示 topnsql 参数必须是整数。||
||设置非MAXIMUM DEFAULT字符串和非number字符串：,目标：验证设置一个非整数值时是否会返回错误。,步骤：,执行 exec dbms_workload_repository.modify_snapshot_settings(topnsql => '10+1');|数据库返回错误，提示 topnsql 参数必须是整数。||
||设置非整数值，长度：,目标：验证设置一个非整数值时是否会返回错误。,步骤：,执行 exec dbms_workload_repository.modify_snapshot_settings(topnsql => lpad('1',65,'2'));, exec dbms_workload_repository.modify_snapshot_settings(topnsql =>lpad('1ees',32000,'2'));, exec dbms_workload_repository.modify_snapshot_settings(topnsql => lpad('test',1024,'1'));|数据库返回错误，提示 topnsql 参数必须是整数。||
||设置非整数值，表达式：,目标：验证设置一个非整数值时是否会返回错误。,步骤：,执行 exec dbms_workload_repository.modify_snapshot_settings(topnsql => 10+10');, exec dbms_workload_repository.modify_snapshot_settings(topnsql => (10+10=20));|数据库返回错误，提示 topnsql 参数必须是整数。||
||设置非整数值、浮点数：,目标：验证设置一个非整数值时是否会返回错误。,步骤：,执行 exec dbms_workload_repository.modify_snapshot_settings(topnsql => 10.111);, exec dbms_workload_repository.modify_snapshot_settings(topnsql => 50000.1);|数据库返回错误，提示 topnsql 参数必须是整数。||
||设置非整数值，类型：,目标：验证设置一个非整数值时是否会返回错误。,步骤：,执行 exec dbms_workload_repository.modify_snapshot_settings(topnsql => false);|数据库返回错误，提示 topnsql 参数必须是整数。||
||设置字符串变量：varchar：,declare,topnsql varchar(200):= 'DEFAULT';,begin,   dbms_workload_repository.modify_snapshot_settings(topnsql=>topnsql);,end;,/|报错？||
||设置字符串变量：char：,declare,topnsql char(200):= 'DEFAULT';,begin,   dbms_workload_repository.modify_snapshot_settings(topnsql=>topnsql);,end;,/|报错？||
||设置字符串变量：timestamp：,declare,topnsql timestamp:= '2000-1-1 12:00:00 00:01:12';,begin,   dbms_workload_repository.modify_snapshot_settings(topnsql=>topnsql);,end;,/|报错？||
||设置字符串变量：clob：,declare,topnsql clob:= 'DEFAULT';,begin,   dbms_workload_repository.modify_snapshot_settings(topnsql=>topnsql);,end;,/|报错？||
||设置字符串变量：char：,declare,topnsql blob:= '1111';,begin,   dbms_workload_repository.modify_snapshot_settings(topnsql=>topnsql);,end;,/|报错？||
|||||
|性能测试：,设置不同的 topnsql 输出行数，观察对性能的影响。,在高负载情况下，查看执行设置命令后对AWR报告的影响。|高负载下设置topnsql值：,目标：验证在高负载情况下，修改 topnsql 是否对系统性能产生影响。可用TPCC模型跑高负载业务。,步骤：,在系统负载较高的情况下执行 exec dbms_workload_repository.modify_snapshot_settings(topnsql => 100);,观察数据库的响应时间和AWR报告的生成时间。|执行命令时不应有明显的性能下降，AWR报告生成应该不受明显影响。||
||大量Top SQL的情况下测试：,目标：验证设置为较大 topnsql 值时，数据库能够正常处理并返回大量数据。可设置500、1000、10000、30000、50000等值。,步骤：,执行 exec dbms_workload_repository.modify_snapshot_settings(topnsql => 500);,生成AWR报告并检查其响应时间和性能。,select TOPNSQL from WRM$_WR_CONTROL;|AWR报告可以正常生成，且数据库没有明显的性能问题。||
|||||
|||||
|安全性和权限测试：,非法权限用户执行该命令时的行为。,验证不同角色（如DBA、普通用户）的权限差异。|没有权限的用户尝试执行：,目标：验证没有权限的用户是否可以执行该命令。,步骤：,使用一个没有DBA权限的普通用户执行 exec dbms_workload_repository.modify_snapshot_settings(topnsql => 100);|返回权限不足的错误。|当前所有用户都可以设置成功，暂时使用这个方案，有规划需求后续做权限划分。|
|||||
|||||
|持久性测试：,查看AWR设置在重启数据库或会话后是否保持。|数据库重启后设置是否持久化：,目标：验证设置 topnsql 的持久性，检查是否在数据库重启后生效。,步骤：,执行 exec dbms_workload_repository.modify_snapshot_settings(topnsql => 50);,重启数据库。,重启后再次查看AWR报告，确认 topnsql 是否仍为50。,select TOPNSQL from WRM$_WR_CONTROL;|实现持久化，topnsql 应继续为 50。||
|||||
|||||
|回滚和恢复测试：,测试如果出错或异常，是否能够恢复为默认的设置。|设置无效值导致回滚：,目标：验证在设置无效 topnsql 值时，数据库是否能够自动恢复默认值。,步骤：,执行 exec dbms_workload_repository.modify_snapshot_settings(topnsql => -100);,查看数据库的行为是否正确回滚并恢复为默认值。|系统返回错误并恢复为默认设置。||
|||||
|升级|旧版本升级到转测版本，升级后验证topnsql设置功能，升级前后生成快照，升级后配置topnsql，执行快照。|正常升级，topnsql设置正常。||






# 6.   **测试用例**

文本用例。

# 7.   **测试框架设计**

   功能手动测试完成之后，采用YPT框架进行自动化测试。

# 8.   **测试环境说明**

|机器：虚拟机IP|192.168.18.112、192.168.18.197|
|---|---|
|操作系统|CentOS7|
|部署|单机、集群数据库|


