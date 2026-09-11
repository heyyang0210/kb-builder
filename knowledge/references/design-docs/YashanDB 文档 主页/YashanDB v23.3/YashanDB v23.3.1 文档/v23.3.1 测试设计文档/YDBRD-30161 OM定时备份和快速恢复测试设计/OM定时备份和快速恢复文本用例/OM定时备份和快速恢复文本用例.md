Created by 李世铭, last modified by  黄思源 on 八月 13, 2024

|序号|测试点|级别|预置条件|测试步骤|预期结果|备注|进度（已测完/已自动化）|
|:---|:---|:---|:---|:---|:---|:---|:---|
|1|process yasom recover参数--role默认值|L0|部署3host一主二备数据库|1.在host002执行yasboot   process yasom recover -c yashan -f -l {ip},2.查看om状态|1.命令执行成功,2.查看om状态成功在host002拉起新的备yasom|  
|已测完|
|2|process yasom recover参数--role取值范围|L1|部署3host一主二备数据库|1.在host002执行yasboot   process yasom recover -c yashan -f -l {ip} --role secondary,2.在host003执行yasboot process yasom recover -c yashan -f -l {ip} --role primary,3.在host003执行yasboot process yasom recover -c yashan -f -l {ip} --role a,4.在host003执行yasboot process yasom recover -c yashan -f -l {ip} --role 1,5.查看om状态|1.命令执行成功,2.命令执行失败，报错已有主yasom,3.命令执行失败，报错role取非法值,4.命令执行失败，报错role取非法值,5.查看om状态成功在host002拉起新的备yasom|  
|已测完|
|3|process yasom recover参数--meta默认值|L0|部署3host一主二备数据库|1.在host002执行yasboot   process yasom recover -c yashan -f -l {ip},2.查看om日志|使用最新的sql文件拉起yasom|  
|已测完|
|4|process yasom recover参数--meta取值范围|L1|部署3host一主二备数据库|1.在host002执行yasboot   process yasom recover -c yashan -f -l {ip} --meta 稍旧的sql文件,2.在host002执行yasboot process yasom recover -c yashan -f -l {ip} --meta 普通文本文件,3.在host002执行yasboot process yasom recover -c yashan -f -l {ip} --meta 错误的文件路径,4.在host002执行yasboot process yasom recover -c yashan -f -l {ip} --meta 最新的备份集sql文件,5.查看om状态|1.报错不是最新的备份集,2.报错不是正确的备份集文件,3.报错文件不存在,4.命令执行成功,5.查看om状态成功在host002拉起新的备yasom|  
|已测完|
|5|process yasom recover参数--listen默认值|L0|部署3host一主二备数据库|1.在host002执行yasboot   process yasom recover -c yashan -f,2.在host002执行yasboot process yasom recover -c yashan -f -l {ip},3.kill host001 yasom，在host002执行yasboot process yasom recover -c yashan -f,4.查看om状态|1.报错直接拉起yasom需要填写监听地址,2.执行成功,3.执行成功,4.host001 yasom进程停止，host002 yasom升主|  
|已测完|
|6|process yasom recover参数--listen取值范围|L1|部署3host一主二备数据库|1.在host002执行yasboot   process yasom recover -c yashan -f -l 非本机ip,2.在host002执行yasboot process yasom recover -c yashan -f -l 错误格式ip,3.在host002执行yasboot process yasom recover -c yashan -f -l 正确的ip,4.查看om状态|1.报错不能绑定ip,2.报错ip格式错误,3.执行成功,4.查看om状态成功在host002拉起新的备yasom|  
|已测完|
|7|process yasom recover参数--force|L0|部署3host一主二备数据库|1.  在host002执行yasboot process yasom recover -c yashan -l {ip}，输入no,2.在host002执行yasboot process yasom recover -c yashan -l {ip}，输入yes,3.查看om状态|1.需要用户二次确认，输入no取消执行,2.二次确认，输入yes拉起备yasom,3.查看om状态成功在host002拉起新的备yasom|  
|已测完|
|8|process yasom recover参数--force-create|L2|部署3host一主二备数据库|1.创建并应用定时任务，每分钟执行sql "select * from v$instance;"，查看job list可以看到定时任务,2.kill 主yasom，在host002执行  yasboot process yasom recover -c yashan -f -l {ip} --meta 在添加定时任务前的备份集 --force-create,3.连接备yasom查看job list|1.定时任务创建成功，可以在job list看到定时任务,2. 备yasom拉起成功,3.job list看不到创建的定时任务|  
|  
|
|9|环境变量YASDB_CONNECTED_OM_ADDR|L1|1.部署3host一主二备数据库,2.在host002拉起备yasom|1.设置  YASDB_CONNECTED_OM_ADDR为0，执行cluster status,2.设置YASDB_CONNECTED_OM_ADDR为1，执行cluster status,3.设置YASDB_CONNECTED_OM_ADDR为-1和2，执行cluster status,4.设置YASDB_CONNECTED_OM_ADDR为主yasom的ip和端口，执行cluster status,5.设置YASDB_CONNECTED_OM_ADDR为备yasom的ip和端口，执行cluster status,6.设置YASDB_CONNECTED_OM_ADDR为备yasom的ip和端口，执行node add,7.设置YASDB_CONNECTED_OM_ADDR为错误的ip格式，执行cluster status|1.通过主yasom执行,2.通过备yasom执行,3.通过主yasom执行,4.通过主yasom执行,5.通过备yasom执行,6.通过主yasom执行,7.通过主yasom执行|  
|已测完|
|10|备份保存策略max_age|L2|部署3host一主二备数据库|1.查看yasagent.conf，max_age默认设置为7d，手动生成超过最小保存数量的备份集后，手动调整系统时间到接近7天后，但不超过7天，等待触发清理的时间间隔后，查看备份集数量；再将时间调整至超过7天，等待触发清理的时间间隔后，查看备份集数量,2.设置max_age为7h，重启yasom，手动生成超过最小保存数量的备份集后，手动调整系统时间到接近7h，但不超过7h，等待触发清理的时间间隔后，查看备份集数量；再将时间调整至超过7h，等待触发清理的时间间隔后，查看备份集数量,3.设置max_age为30min，重启yasom，手动生成超过最小保存数量的备份集后，手动调整系统时间到接近30min，但不超过30min，等待触发清理的时间间隔后，查看备份集数量；再将时间调整至超过30min，等待触发清理的时间间隔后，查看备份集数量,4.设置max_age为1200s，重启yasom，手动生成超过最小保存数量的备份集后，手动调整系统时间到接近1200s，但不超过1200s，等待触发清理的时间间隔后，查看备份集数量；再将时间调整至超过1200s，等待触发清理的时间间隔后，查看备份集数量|1.手动调整系统时间到接近7天后，但不超过7天时，不会清理备份集，超过7天后，清理备份集的数量到最小保存份数,2.手动调整系统时间到接近7h，但不超过7h，不会清理备份集，超过7h后，清理备份集的数量到最小保存份数,3.手动调整系统时间到接近30min，但不超过30min，不会清理备份集，超过30min后，清理备份集的数量到最小保存份数,4.手动调整系统时间到接近1200s，但不超过1200s，不会清理备份集，超过1200s后，清理备份集的数量到最小保存份数|  
|  
|
|11|重复拉起yasom|L1|1.部署3host一主二备数据库,2.在host002拉起备yasom|1.在host002执行yasboot   process yasom recover -c yashan -f -l {ip}|保存此机器已经拉起yasom|  
|已测完|
|12|隔离主yasom，备yasom升主|L1|1.部署3host一主二备数据库,2.在host002拉起备yasom|隔离host001，在host002执行yasboot process yasom recover -c yashan -f --role primary|执行成功，host002备yasom生主|  
|已测完|
|13|隔离主yasom，拉起主yasom|L1|部署3host一主二备数据库|隔离host001，在host002执行yasboot process yasom recover -c yashan -f -l {ip} --role primary|执行成功，再host002拉起主yasom|  
|已测完|
|14|异常状况下恢复主yasom|L2|部署3host一主二备数据库|1.node add后，同步备份集时kill 主yasom,2.恢复host001，重新拉起主yasom,3.查看om状态和节点状态|om和节点状态恢复正常|  
|  
|
|15|清理主yasom|L1|部署3host一主二备数据库|尝试清理主yasom |报错不可以清理主yasom|  
|已测完|
|16|清理备yasom|L1|1.部署3host一主二备数据库,2.在host002拉起备yasom|尝试清理host002 yasom|清理成功|  
|已测完|
|17|没有yasom的host执行|L1|部署3host一主二备数据库|在host002执行清理yasom|报错yasom不存在|  
|已测完|
|18|同步env|L2|部署3host一主二备数据库|1.隔离host003，在host002拉起备yasom，恢复host003，查看om状态,2.执行env同步，查看om状态|1.host003没有更新备yasom信息,2.host003备om信息同步正常|  
|  
|
|19|构造双主并清理一个主|L3|部署3host一主二备数据库|1.  执行node add，并在同步备份集时隔离host001，node add操作没有同步到备机,2.  host002拉起主yasom，执行job add,3.  恢复host001，查看process yasom status,4.清理host002 yasom，执行yasboot process yasom sync|1.没有同步备份集到备机,2.主yasom拉起成功，job add成功,3.可以看到有两个主yasom，并且host001和host002认定的主不同,4.清理时给出  每个主om的incr值和节点数量信息，清理host002成功，执行env同步成功，查看yasom状态，各个节点认定的主一致，om恢复正常，且job list没有第2步中添加的job|  
|  
|
|20|主动同步模式async|L2|部署3host一主二备数据库|1.执行job add，同步备份集时隔离主机|父任务返回成功|  
|  
|
|21|主动同步模式sync_half|L2|1.部署3host一主二备数据库,2.yasom.tom设置  sync_mode=“sync_half”|1.执行job add，同步备份集时隔离主机,2.设置  sync_retry_time=5，重启yasom，执行job add，同步备份集时隔离主机|1.命令返回warning，备份集同步失败，查看日志有3次重试,2.命令返回warning，备份集同步失败，查看日志有5次重试|  
|  
|
|22|升级及回退|L3|1.部署3host一主二备数据库,2.在host002拉起备yasom|1.执行package upgrade,2.执行package rollback|备yasom可以正常升级、回退|  
|  
|
|23|failover|L3|1.部署3host一主二备数据库,2.在host002拉起备yasom|隔离host001，在host002拉起主yasom，执行node failover，查看集群状态|failover成功，node2升主|  
|  
|
