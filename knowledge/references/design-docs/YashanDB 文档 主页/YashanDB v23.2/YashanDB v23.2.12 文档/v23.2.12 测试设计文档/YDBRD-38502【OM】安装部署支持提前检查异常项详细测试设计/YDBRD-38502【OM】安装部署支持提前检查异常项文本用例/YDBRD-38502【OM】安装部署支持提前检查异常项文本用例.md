|序号|测试点|级别|预置条件|测试步骤|预期结果|备注|进度（已测完/已自动化）|
|---|:---|:---|:---|:---|:---|:---|:---|
|1|--yas-type默认值|L1|1.已获取数据库包并解压|执行yasboot init，不填写--yas-type参数|不设置默认值，后续通过交互式填写部署形态|  
|  
|
|2|--yas-type非法值|L2|1.已获取数据库包并解压|执行yasboot init，--yas-type填写-1，0，a，DE|报错参数值错误|||
|3|--yas-type正常值|L0|1.已获取数据库包并解压|执行yasboot init，--yas-type填写ce|正常部署集群数据库|||
|4|--yas-type正常值|L0|1.已获取数据库包并解压|执行yasboot init，--yas-type填写SE|正常部署集群数据库|||
|5|--group默认值|L1|1.已获取数据库包并解压|执行yasboot init，不填写--group参数|默认值是1，也可以通过交互式修改参数值|||
|6|--group非法值|L2|1.已获取数据库包并解压|执行yasboot init，--group填写-1，0，a|报错参数值错误|||
|7|--group正常值|L0|1.已获取数据库包并解压|执行yasboot init，--group填写1|正常部署1 group集群数据库|||
|8|--group正常值|L0|1.已获取数据库包并解压|执行yasboot init，--group填写2|正常部署2 group集群数据库|||
|9|--standby-node默认值|L1|1.已获取数据库包并解压|执行yasboot init，不填写--standby-node参数|默认与--node一致，也可以通过交互式修改参数值|||
|10|--standby-node非法值|L2|1.已获取数据库包并解压|执行yasboot init，--standby-node填写-1，0，a|报错参数值错误|||
|11|--standby-node非法值|L2|1.已获取数据库包并解压|执行yasboot init，--standby-node填写大于--node的值|报错备集群node数量不能超过主集群|||
|12|--standby-node正常值|L0|1.已获取数据库包并解压|执行yasboot init，--standby-node填写小于或等于--node的正整数|正常部署主备集群|||
|13|--failgroup默认值|L1|1.已获取数据库包并解压|执行yasboot init，不填写--  failgroup  参数|默认值是1，也可以通过交互式修改参数值|||
|14|--  failgroup  非法值|L2|1.已获取数据库包并解压|执行yasboot init，--  failgroup  填写-1，0，a|报错参数值错误|||
|15|--failgroup正常值|L0|1.已获取数据库包并解压|执行yasboot init，--  failgroup  填写1|正常部署1   failgroup  集群数据库|||
|16|--failgroup正常值|L0|1.已获取数据库包并解压|执行yasboot init，--  failgroup  填写2|正常部署2   failgroup  集群数据库|||
|17|--ce-vote默认值|L1|1.已获取数据库包并解压|执行yasboot init，不填写--ce-vote参数|后续通过交互式填写vote盘路径|||
|18|--ce-vote非法值|L2|1.已获取数据库包并解压|执行yasboot init，--ce-vote填写错误磁盘路径|在生成配置时可以提前检查并可以交互式修改|||
|19|--ce-vote正常值|L0|1.已获取数据库包并解压|执行yasboot init，--ce-vote填写正确磁盘路径|正常部署集群|||
|20|--ce-ycr默认值|L1|1.已获取数据库包并解压|执行yasboot init，不填写--ce-ycr参数|后续通过交互式填写ycr盘路径|||
|21|--ce-ycr非法值|L2|1.已获取数据库包并解压|执行yasboot init，--ce-ycr填写错误磁盘路径|在生成配置时可以提前检查并可以交互式修改|||
|22|--ce-ycr正常值|L0|1.已获取数据库包并解压|执行yasboot init，--ce-ycr填写正确磁盘路径|正常部署集群|||
|23|--ce-data默认值|L1|1.已获取数据库包并解压|执行yasboot init，不填写--ce-data参数|后续通过交互式填写data盘路径|||
|24|--ce-data非法值|L2|1.已获取数据库包并解压|执行yasboot init，--ce-data填写错误磁盘路径|在生成配置时可以提前检查并可以交互式修改|||
|25|--ce-data正常值|L0|1.已获取数据库包并解压|执行yasboot init，--ce-data填写正确磁盘路径|正常部署集群|||
|26|不带--yfs-force-create|L1|1.已获取数据库包并解压|执行yasboot init部署集群数据库，不带--yfs-force-create参数|生成配置时给出warning，部署时报错|||
|27|带--yfs-force-create|L0|1.已获取数据库包并解压|执行yasboot init部署集群数据库，带--yfs-force-create参数|正常部署集群|||
|28|提前检查主机名|L2|1.已获取数据库包并解压,2.修改主机名为不符合要求的主机名|执行yasboot init部署集群数据库，不带隐藏参数--ignore-hostname|yasboot init生成配置时报错，并且提示清晰|||
|29|提前检查磁盘权限|L2|1.已获取数据库包并解压|修改data盘权限为775，使用yasboot init部署|yasboot init生成配置时报错，并且提示清晰，可以交互式填写新的磁盘路径|||
|30|提前检查磁盘权限|L2|1.已获取数据库包并解压|修改ycr盘权限为775，使用yasboot init部署|yasboot init生成配置时报错，并且提示清晰，可以交互式填写新的磁盘路径|||
|31|提前检查磁盘权限|L2|1.已获取数据库包并解压|修改vote盘权限为775，使用yasboot init部署|yasboot init生成配置时报错，并且提示清晰，可以交互式填写新的磁盘路径|||
|32|提前检查磁盘权限|L2|1.已获取数据库包并解压|修改data盘权限为775，使用omweb部署|可以提前检查并报错|||
|33|提前检查磁盘权限|L2|1.已获取数据库包并解压|修改ycr盘权限为775，使用omweb部署|可以提前检查并报错|||
|34|提前检查磁盘权限|L2|1.已获取数据库包并解压|修改vote盘权限为775，使用omweb部署|可以提前检查并报错|||


