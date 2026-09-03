|序 号|测试点|级别|预置条件|测试步骤|预期结果|备注|进度（已测完）|
|:---|:---|:---|:---|:---|:---|:---|:---|
|1|server_info填写正常值|L0||1.执行yaslicense esn gen，server_info填写本机server_info,2.执行yaslicense esn gen，server_info填写其他机器server_info,3.执行yaslicense esn gen，server_info填写空字符串|1.根据本机信息生成esn,2.根据填写的机器信息生成esn,3.与填写本机信息生成esn相同|||
|2|server_info填写异常值|L2||1.执行yaslicense esn gen，server_info填写超过256个字符的字符串|报错字符串长度超过限制|||
|3|检查server_info是否必填|L1||1.执行yaslicense esn gen，省略参数server_info|报错缺少必填参数server_info|||
|4|esn_version填写正常值|L0||1.执行yaslicense esn gen，esn_version填写V1|正常生成esn信息|||
|5|esn_version填写异常值|L2||1.执行yaslicense esn gen，esn_version填写其他字符串|报错|||
|6|检查esn_version是否必填|L1||1.执行yaslicense esn gen，省略参数esn_version|报错缺少必填参数esn_version|||
|7|EsnInfo填写正常值|L0||1.执行yaslicense license gen，填写本机esn,2.执行yaslicense license gen，填写多个机器esn|1.正常生成license文件,2.正常生成license文件|||
|8|EsnInfo填写异常值|L2||1.执行yaslicense license gen，EsnInfo填写超过4096字符的字符串|报错字符串长度超过限制|||
|9|检查EsnInfo是否必填|L1||1.执行yaslicense license gen，省略参数EsnInfo|报错缺少必填参数EsnInfo|||
|10|LicenseType填写正常值|L0||1.执行yaslicense license gen，LicenseType填写TRIAL,2.执行yaslicense license gen，LicenseType填写ENTERPRISE|1.正常生成试用版license文件,2.正常生成企业版license文件|||
|11|LicenseType填写异常值|L2||1.执行yaslicense license gen，LicenseType填写其他字符串|报错|||
|12|检查LicenseType是否必填|L1||1.执行yaslicense license gen，省略参数LicenseType|报错缺少必填参数LicenseType|||
|13|LicenseVersion填写正常值|L0||1.执行yaslicense license gen，LicenseVersion填写V1|正常生成V1版license|||
|14|LicenseVersion填写异常值|L2||1.执行yaslicense license gen，LicenseVersion填写其他字符串|1.报错未支持版本|||
|15|检查LicenseVersion是否必填|L1||1.执行yaslicense license gen，省略LicenseVersion|1.报错缺少必填参数LicenseVersion|||
|16|DeployType填写正常值|L0||1.执行yaslicense license gen，DeployType填写ALL, Cluster, Distributed, Standalone, Cluster&Distributed, Cluster&Standalone, Distributed&Standalone|1.正常生成对应形态的license文件|||
|17|DeployType填写异常值|L2||其他字符串|1.报错部署形态错误|||
|18|检查DeployType是否必填|L1||1.省略参数DeployType|1.报错缺少必填参数DeployType|||
|19|ExpiredDays填写正常值|L0||1.执行yaslicense license gen，ExpiredDays填写90,2.执行yaslicense license gen，ExpiredDays填写4,294,967,295|1.可以正常生成license,2.可以正常生成无限制天数的license|||
|20|ExpiredDays填写异常值|L2||1.执行yaslicense license gen，ExpiredDays填写0、-1,2.执行yaslicense license gen，ExpiredDays填写不符合整数格式的字符串,3.执行yaslicense license gen，ExpiredDays填写4,294,967,296|1.报错不允许取值,2.报错格式错误,3.报错超过范围|||
|21|检查ExpiredDays是否必填|L1||1.执行yaslicense license gen，省略参数ExpiredDays|1.报错缺少必填参数ExpiredDays|||
|22|ClusterVersion填写正常值|L0||1.执行yaslicense license gen，ClusterVersion填写V23.4|可以正常生成license|||
|23|ClusterVersion填写异常值|L2||1.执行yaslicense license gen，ClusterVersion填写超过16字符的字符串|报错字符串长度超过限制|||
|24|检查ClusterVersion是否必填|L1||1.执行yaslicense license gen，省略参数ClusterVersion|报错缺少必填参数ClusterVersion|||
|25|MaxNode填写正常值|L0||1.执行yaslicense license gen，MaxNode填写32|可以正常生成license|||
|26|MaxNode填写异常值|L2||1.执行yaslicense license gen，MaxNode填写0、-1,2.执行yaslicense license gen，MaxNode填写非整数格式的字符串|1.报错不允许取值,2.报错格式错误|||
|27|检查MaxNode是否必填|L1||1.执行yaslicense license gen，省略MaxNode|可以正常生成license|||
|28|MaxConnection填写正常值|L0||1.执行yaslicense license gen，MaxConnection填写1024|可以正常生成license|||
|29|MaxConnection填写异常值|L2||1.执行yaslicense license gen，MaxConnection填写0、-1,2.执行yaslicense license gen，MaxConnection填写不符合整数格式的字符串|1.报错不允许取值,2.报错格式错误|||
|30|检查MaxConnection是否必填|L1||1.执行yaslicense license gen，省略参数MaxConnection|可以正常生成license|||
|31|Function填写正常值|L0||1.执行yaslicense license gen，Function填写不超过256字符的随机字符串,2.执行yaslicense license gen，Function填写空字符串|1.可以正常生成license,2.可以正常生成license|||
|32|Function填写异常值|L2||1.执行yaslicense license gen，Function填写超过256字符的随机字符串|报错字符串长度超过限制|||
|33|检查Function是否必填|L1||1.执行yaslicense license gen，省略Function|可以正常生成license|||
|34|高级包dbms_license.update_license，liceseFilePath填写正常值|L0|1.已部署单机一主二备数据库,2.填写正确信息生成license|1.使用高级包dbms_license.update_license更新lincense，liceseFilePath填写正确的企业版license文件路径|可以正常更新license|||
|35|高级包dbms_license.update_license，liceseFilePath填写异常值|L2|1.已部署单机一主二备数据库,2.填写正确信息生成license|1.使用高级包dbms_license.update_license更新lincense，liceseFilePath填写空字符串,2.使用高级包dbms_license.update_license更新lincense，liceseFilePath填写错误路径|1.报错文件不存在,2.报错文件不存在|||
|36|高级包dbms_license.update_license，检查liceseFilePath参数是否必填|L1|1.已部署单机一主二备数据库,2.填写正确信息生成license|1.使用高级包dbms_license.update_license更新lincense，省略参数liceseFilePath|报错缺少必填参数liceseFilePath|||
|37|单机数据库起库自动生成试用版license信息|L0||1.部署单机一主二备数据库,2.查询gv$license视图|gv$license视图各字段数据符合预期|||
|38|共享集群数据库起库自动生成试用版license信息|L0||1.部署三实例共享集群数据库,2.查询gv$license视图|gv$license视图各字段数据符合预期|||
|39|单机通过配置参数更新license|L1|1.使用yaslicense生成企业版license,2.部署单机一主二备数据库|1.设置各实例INSTANCE_LICENSE_FILE_PATH配置参数为license文件路径,2.重启数据库|数据库重启成功，查看gv$license视图各实例更新为新的企业版license，各字段符合预期|||
|40|单机通过高级包更新license|L1|1.使用yaslicense生成企业版license,2.部署单机一主二备数据库|1.执行高级包dbms_license.update_license，参数填写license文件路径|高级包执行成功，查看gv$license视图各实例更新为新的企业版license，各字段符合预期|||
|41|共享集群通过配置参数更新license|L1|1.使用yaslicense生成企业版license,2.部署共享集群三实例数据库|1.设置各实例INSTANCE_LICENSE_FILE_PATH配置参数为license文件路径,2.重启数据库|数据库重启成功，查看gv$license视图各实例更新为新的企业版license，各字段符合预期|||
|42|共享集群通过高级包更新license|L1|1.使用yaslicense生成企业版license,2.部署共享集群三实例数据库|1.执行高级包dbms_license.update_license，参数填写license文件路径|高级包执行成功，查看gv$license视图各实例更新为新的企业版license，各字段符合预期|||
|43|单机数据库使用非单机类型license|L2|1.部署单机一主二备数据库|1.lincense文件部署形态填写Cluster，执行高级包dbms_license.update_license,2.lincense文件部署形态填写Distributed，执行高级包dbms_license.update_license,3.lincense文件部署形态填写Cluster&Distributed，执行高级包dbms_license.update_license|1.报错，更新失败,2.报错，更新失败,3.报错，更新失败|||
|44|单机数据库使用包含单机类型license|L2|1.部署单机一主二备数据库|1.lincense文件部署形态填写ALL，执行高级包dbms_license.update_license,2.lincense文件部署形态填写Standalone，执行高级包dbms_license.update_license,3.lincense文件部署形态填写Cluster&Standalone，执行高级包dbms_license.update_license,4.lincense文件部署形态填写Distributed&Standalone，执行高级包dbms_license.update_license|1.高级包执行成功，查看gv$license视图各实例更新为新的企业版license，各字段符合预期,2.高级包执行成功，查看gv$license视图各实例更新为新的企业版license，各字段符合预期,3.高级包执行成功，查看gv$license视图各实例更新为新的企业版license，各字段符合预期,4.高级包执行成功，查看gv$license视图各实例更新为新的企业版license，各字段符合预期|||
|45|共享集群数据库使用非共享集群类型license|L2|1.部署三实例共享集群数据库|1.lincense文件部署形态填写Distributed，执行高级包dbms_license.update_license,2.lincense文件部署形态填写Standalone，执行高级包dbms_license.update_license,3.lincense文件部署形态填写Distributed&Standalone，执行高级包dbms_license.update_license|1.报错，更新失败,2.报错，更新失败,3.报错，更新失败|||
|46|共享集群数据库使用含有共享集群类型license|L2|1.部署三实例共享集群数据库|1.lincense文件部署形态填写ALL，执行高级包dbms_license.update_license,2.lincense文件部署形态填写Cluster，执行高级包dbms_license.update_license,3.lincense文件部署形态填写Cluster&Distributed，执行高级包dbms_license.update_license,4.lincense文件部署形态填写Cluster&Standalone，执行高级包dbms_license.update_license|1.高级包执行成功，查看gv$license视图各实例更新为新的企业版license，各字段符合预期,2.高级包执行成功，查看gv$license视图各实例更新为新的企业版license，各字段符合预期,3.高级包执行成功，查看gv$license视图各实例更新为新的企业版license，各字段符合预期,4.高级包执行成功，查看gv$license视图各实例更新为新的企业版license，各字段符合预期|||
|47|license中的esn信息与单机数据库实例所在服务器的esn信息不一致|L3|1.部署单机一主二备数据库|1.使用yaslicense生成企业版license，填写esn不包含主机所在服务器的esn,2.执行高级包dbms_license.update_license，参数填写license文件路径|报错，更新失败|||
|48|license中的esn信息与集群数据库实例所在服务器的esn信息不一致|L3|1.部署三实例共享集群数据库|1.使用yaslicense生成企业版license，填写esn不包含执行更新实例所在服务器的esn,2.执行高级包dbms_license.update_license，参数填写license文件路径|报错，更新失败|||
|49|license中的版本号信息与数据库实例的版本号不一致|L3|1.部署单机一主二备数据库|1.使用yaslicense生成企业版license，填写数据库版本号为V23.3,2.执行高级包dbms_license.update_license，参数填写license文件路径|报错，更新失败|||
|50|单机数据库license剩30天到期时写告警日志|L2|1.部署单机一主二备数据库|1.使用yaslicense生成企业版license，有效期为90天,2.执行高级包dbms_license.update_license，参数填写license文件路径,3.调整系统时间致至有效天数接近剩余30天,4.查看告警日志，等待有效天数剩余不到30天再次查看告警日志|1.剩余天数多于30天时不写告警日志,2.剩余天数不足30天时写告警日志|||
|51|共享集群数据库license剩30天到期时写告警日志|L2|1.部署三实例共享集群数据库|1.使用yaslicense生成企业版license，有效期为90天,2.执行高级包dbms_license.update_license，参数填写license文件路径,3.调整系统时间致至有效天数接近剩余30天,4.查看告警日志，等待有效天数剩余不到30天再次查看告警日志|1.剩余天数多于30天时不写告警日志,2.剩余天数不足30天时写告警日志|||
|52|单机数据库license过期限制登录|L1|1.部署单机一主二备数据库|1.使用yaslicense生成企业版license，有效期为90天,2.执行高级包dbms_license.update_license，参数填写license文件路径,3.调整系统时间致至有效天数接近过期,4.登录数据库，等待过期后重新登录数据库|1.接近过期但还没过期时可以登录数据库,2.过期后限制登录数据库|||
|53|共享集群数据库license过期限制登录|L1|1.部署三实例共享集群数据库|1.使用yaslicense生成企业版license，有效期为90天,2.执行高级包dbms_license.update_license，参数填写license文件路径,3.调整系统时间致至有效天数接近过期,4.登录数据库，等待过期后重新登录数据库|1.接近过期但还没过期时可以登录数据库,2.过期后限制登录数据库|||
|54|限制更新被篡改的license|L1|1.部署单机一主二备数据库|1.使用yaslicense生成企业版license，有效期为90天,2.手动修改license若干字段,3.执行高级包dbms_license.update_license，参数填写license文件路径|报错，更新失败|||
|55|单机数据库升级后可以正常使用license功能|L3|1.部署旧版本单机一主二备数据库|1.升级到新版本，查询gv$license,2.使用yaslicense生成企业版license,3.执行高级包dbms_license.update_license，参数填写license文件路径|1.升级后自动生成试用版licensen信息，gv$license视图各字段数据符合预期,2.可以正常更新企业版license，gv$license视图各字段数据符合预期|||
|56|共享集群数据库升级后可以正常使用license功能|L3|1.部署旧版本三实例共享集群数据库|1.升级到新版本，查询gv$license,2.使用yaslicense生成企业版license,3.执行高级包dbms_license.update_license，参数填写license文件路径|1.升级后自动生成试用版licensen信息，gv$license视图各字段数据符合预期,2.可以正常更新企业版license，gv$license视图各字段数据符合预期|||
|57|单机数据库扩容后可以正常使用license功能|L3|1.部署单机一主二备数据库|1.使用yaslicense生成企业版license,2.执行高级包dbms_license.update_license，参数填写license文件路径,3.执行扩容，新增备节点，登录备节点查询v$license视图|扩容成功，v$license视图信息与主节点v$license视图一致|||


