Created by 梁桢灏, last modified on 一月 18, 2024

#   [LSC支持增删列特性](#lsc支持增删列特性)  

##   [1. Overview（概述）](#1-overview概述)  

LSC能力补全，LSC表支持alter add column与alter drop column特性，通过alter add/drop 增删表列属性。

##   [2. Features（功能特性）](#2-features功能特性)  

LSC支持增删列特性

##   [3. Interfaces（接口）](#3-interfaces接口)  

##   [4. Limitations（功能限制）](#4-limitations功能限制)  

- 1.LSC表目前只支持增加默认列，或者null列，暂不支持增列后立即回填该列的情况（如lob和序列默认值）。
- 2.只支持通过alter add/drop的增删列特性，不支持alter add/drop外键，主键等特性。
- 3.add column特性只支持目前lsc表支持的列类型。
- 4.不支持删除order key 列。
- 5.其他限制于tac和heap相同


##   [5. Detail Design（详细设计）](#5-detail-design详细设计)  

###   [5.1 删列](#51-删列)  

####   [5.1.1 热数据删列](#511-热数据删列)  

热数据使用的为swf结构，swf在删列时先删除系统表列相关信息，然后删除col_seg$中该列的segment，再删除segment中该列的元数据信息。

spf使用swf存储热数据，因此热数据可复用这部分逻辑，通过swd找到对应vgd的swf结构，从col_seg$中删除vgd的列的segment，在修改vgd的segment中的列元数据。后续热数据插入通过swf内部逻辑处理删列逻辑。

####   [5.1.2 冷数据删列](#512-冷数据删列)  

冷数据为coast静态数据，以slice文件形式存储下来，删列时只需要删除静态数据中的列数据删除即可。使用延迟清理机制将slice列文件进行删除。

columnMeta文件将删除，sliceMeta中的中元数据不做修改保持原值。

lsc的sliceSize目前只给视图使用，可以改为sliceSize访问时到访问每个columnMeta中的dataSize进行累加得到，不再从sliceMeta中直接获取sliceSize。

####   [5.1.3 后台任务](#513-后台任务)  

在执行删列时，因为这是ddl会导致后台任务拿不到表锁，当结束时，后台任务持有旧dc进行转换操作时，会发现该dc是无效的dc，插入失败。因此后台任务只需让ddl能在上表锁时打断后台任务从而持有排他锁即可。

###   [5.2 增列](#52-增列)  

####   [5.2.1 热数据增列](#521-热数据增列)  

与热数据删列相同方法，依赖swf的增列机制，只需要在增列流程中把swf对应的元数据修改即可，后续在插入更新过程中会触发swf内部逻辑处理增列逻辑。

####   [5.2.2 冷数据增列](#522-冷数据增列)  

冷数据增列时，由于冷数据的更新和删除只会删除对应的bitmap，更新时会重新插入会热数据部分，即冷数据的更新删除时，冷数据文件不会发生对应变化，且该特性目前不支持立即回填，因此该列的slice文件可以不用创建，在查询时通过对dataset根据默认值或null值构造该列即可。当底层发现columnId大于sliceMeta中最大的columnId时认为该列为增列，使用null值或默认值进行dataset的构造，不需要读取文件。

###   [5.3 增删列可见性](#53-增删列可见性)  

####   [5.3.1 删列可见性](#531-删列可见性)  

删列后该列的dc不应该访问到该列，旧访问持有旧dc访问老列的文件，若columnMeta中的columnNum未修改情况下，columnNum大于等于所需访问的columnId，当文件未删除时可访问；当文件删除时报错找不到文件。若columnNum放在swd中实现多版本，columnNum为原值，当文件未删除时可访问；当文件删除时报错找不到文件。

####   [5.3.2 增列可见性](#532-增列可见性)  

增列后，旧查询持有原有dc访问不会访问到新增列，因此不会触发新列的构造。而新查询查询时，若columnMeta中的columnNum未修改情况下，columnNum小于所需访问的columnId，默认为需要构造dataset的新增列，此时该列不需要访问文件直接构造即可。若columnNum放在swd中实现多版本，columnNum为新值，与columnMeta中的columnNum多出的列认为是新增列，构造dataset的新增列。

####   [5.3.3 列可见性通过dc版本来控制](#533-列可见性通过dc版本来控制)  

swf 增删列需要ecn是为了防止页面复用，spf当前方案中暂不会构造slice文件，因此无需版本控制，只需通过dc的版本，选择是否需要构造dataset。

####   [5.3.4 主备同步](#534-主备同步)  

如果需要删除slice列文件，但主备目前lsc开最大保护模式，不会删除slice文件。

####   [5.3.5 构造dataset](#535-构造dataset)  

dataset构造默认值需要tabledict中的ankColumn，即coral这层需要感知tabledc，cosDataset转dataset这层放于coral层。根据default值构造dataset。

原表查询时，sliceReader上添加标记位，标记该slice查询是否全部为虚构列。全为虚构列，则查询根据sliceRowNum和maxBlockSize构造dataset长度。若存在虚构列与实际列混合情况，根据实际的blockSize构造dataset长度。

##   [6. 测试用例](#6-测试用例)  

##   [7. Document（资料）](#7-document资料)  

##   [8. Workload（工作量）](#8-workload工作量)  

##   [9. TODO（遗留问题）](#9-todo遗留问题)  