

*文档标题格式：YDBRD-XXXX : XXX Design（XXX特性设计） *

*SR链接：*  [*YDBRD-XXXX *](https://pingcode.yasdb.com/ship/ideas/67493af3c3c68d84e9d64915?)  

  [https://pingcode.yasdb.com/ship/ideas/67493af3c3c68d84e9d64915?](https://pingcode.yasdb.com/ship/ideas/67493af3c3c68d84e9d64915?)  

#YASHAN-3520  分布式列存支持地理位置函数ST_DISTANCE_SPHERE





# 1 简介



## 1.1 目的

对YashanDB的分布式列存支持ST_DISTANCE_SPHERE特性进行设计，明确主要的数据结构和主要处理过程，作为后续编码阶段的输入和编码、测试人员的指导。



## 1.2 范围

外场需求，在分布式场景下使用到ST_DISTANCE_SPHERE函数。

支持的部署为单机和分布式的行列存



# 2 特性需求概述

ST_DISTANCE_SPHERE属于地理处理函数，分布式下未引入GIS插件库，当前版本需要引入GIS插件库，但是只对外开放ST_DISTANCE_SPHERE的距离函数。



# 3 需求场景分析（可选）

概要设计中已经系统性阐述的，本章节可以省略，或根据特性设计中对场景的扩展进行补充。没有概要设计的，本章节需要分析。



## 3.1 需求来源

来源于深圳公安客户需求，需要有经纬度距离计算能力。



## 3.2 价值概述

客户必备函数，如果没有这个函数，则无法提供主要的查询服务。



## 3.3 特性场景分析

描述该特性的业务使用场景。

函数：

DOUBLE ST_Distance_Sphere(DOUBLE x_lng, DOUBLE x_lat, DOUBLE y_lng, DOUBLE y_lat)

计算地球两点之间的球面距离，单位为 米。传入的参数分别为X点的经度，X点的纬度，Y点的经度，Y点的纬度。

x_lng 和 y_lng 都是经度数据，合理的取值范围是 [-180, 180]。 x_lat 和 y_lat 都是纬度数据，合理的取值范围是 [-90, 90]。超过范围返回NULL。有参数为NULL时返回NULL。

> ##DDL语句：    CREATE TABLE Tx_profile_trace(  pass_time DATETIME NOT NULL,  profile_id BIGINT NOT NULL,  sbid BIGINT NOT NULL,  pass_time_ymd INT NOT NULL,  pass_time_h TINYINT NOT NULL,  jwdm  VARCHAR(12),  face_no VARCHAR(48) NOT NULL,  profile_no VARCHAR(48) NOT NULL,  sbbm VARCHAR(20) NOT NULL,  sbmc VARCHAR(200) NULL,  azdz VARCHAR(256) NULL,  azdzbm VARCHAR(8) NULL,  px DECIMAL(10,6) NULL,  py DECIMAL(10, 6) NULL,  thumb_url VARCHAR(256) NOT NULL,  scene_url VARCHAR(256) NOT NULL,  jIsj DATETIME NULL,  xh_pic_id VARCHAR(8) NULL,  createtime DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,  pass_time_str BIGINT NULL,  rowstate TINYINT NULL DEFAULT 1,  UNIQUE KEY(pass_time, profile_id,sbid, pass_time_ymd, pass_time_h. jwdm, face_no)  );        ## 查询语句：    with s1 as (  select PASS_TIME, PROFILE_ID,SBID,face_no,PROFILE_NO,SBBM,SBMC,THUMB_URL,SCENE_URL,px,py from rx_profile_trace where pass_time>='2024-05-30 15:27:40'and pass_time<='2024-06-29 15:27:4044),   s2 as(  select PASS_TIMEPROFILE_ID,SBID,face_no,PROFILE_NO,SBBM,SBMC,THUMB_URL,SCENE_URL,px,py from rx_profile_trace where pass_time> ='2024-05-30 15:27:40 and pass_time<='2024-06-29 15:27:40’ and profile_id=3423353 and (SBID >=30000000000000000)),  s3 as (  select s2.face_no,s2.PROFILE_ID,s2.SBBM,s2.PASS_TIME,s2.px,s2.py,  s1.face_no as 同行人face_no,s1.PROFILE_ID as 同行人profile_id,s1.PASS_TIME as 同行人抓拍时间,s1.px as 同行人经度s1.py as 同行人纬度   lag(s1.PASS_TIME1,'1900-01-0100:00:00') over(partition by s2.profile_id,s1.profile_id,s2.sbbm order by s2.PASS_TIME,s1.pass_time) as 同行人上一条抓拍时间,lag(s1.px,1,114) over(partition by s2.profile_id,s1.profile_id,s1.px,s1.py order by s2.PASS_TIME,s1.pass_time) as 同行人上一条px,1z |ag(s1.py.1,22) over(partition by s2,profile_id,s1.profile_id, s1.px,s1.py order by s2.PASS_TIME,s1.pass_time) as 同行人上一条py from s2 inner join s1 on s1.PASS_TIME between seconds_add(s2.PASS_TIME,60)  and seconds_add(s2.PASS_TIME,60 ) and s1.PROFILE_ID<>s2.PROFILE_ID and s2.SBID=s1.SBID and s1.PROFILE_ID=2825055015).s4 as(  select *,seconds_diff(同行人抓拍时间,同行人上一条抓拍时间) as 时间间隔,  ST_Distance_Sphere(同行人经度,同行人纬度,同行人上一条px,同行人上一条py) as 距离米,  case  -- when seconds_diff(同行人抓拍时间,同行人上一条抓拍时间<600 and ST_Distance_Sphere(同行人经度,同行人纬度,同行人上一条px,同行人上一条py)=0 then 0  when seconds_diff(同行人抓拍时间,同行人上一条抓拍时间)>=600 then 1 else 0 end flag from s3)  select * from s4 where flag=1  order by profile_id,同行人profile_id,PASS_TIME,同行人抓拍时间 asc;



## 3.4 特性影响分析

描述该特性在整个系统中的位置及周边接口，与其他需求及特性的交互分析，兼容性分析，安全性分析等。

下面给出DFX维度的特性影响CheckList，特性设计中针对本特性的设计范围进行分析。

|维度|说明|
|---|---|
|性能|*性能指系统的响应能力，即要经过多长时间才能对某个事件做出响应，或者某段时间内系统所能处理的事件个数。*    |
|可用性|*可用性指系统能够正常运行的时间比例。经常用两次故障之间的时间长度或出现故障时系统恢复正常的速度来表示。*   |
|可靠性|*可靠性是软件系统在应用或系统错误面前，维持软件系统的功能特性的基本能力。*|
|可测试性|*可测试性指通过测试揭示软件缺陷的容易程度。*|
|安全性|*安全性指系统在向合法用户提供服务的同时能够阻止非授权用户使用的企图或拒绝服务的能力。*,*安全性分析为必选项，不涉及要明确说明。*|
|易用性|*易用性指关注对用户来说完成某个期望任务的容易程度和系统所提供的用户支持的种类。*|
|可修改性|*可修改性指能够快速地以较高的性价比对系统进行变更的能力。*|
|兼容性|*兼容性指特性开发是否向前兼容，是否涉及升级。*|




## 3.5 外部依赖分析（可选）

无新增外部依赖库



## 3.6 业内方案分析（可选）

常用计算距离方式：

1. 使用下面的经纬度计算公式，优点：计算速度快，缺点：未考虑地球的非球形曲率，精度相对于google地图低，误差在0.2m左右


![WXWorkLocalPro_173327751042.png](https://pingcode.yasdb.com/atlas/files/public/67516158a1ad9a3311de4221/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUVBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFJQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFnQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzNDUyOTIsImV4cCI6MTc4MjM1NjA5Mn0.DOKK0k4nQTkathyJCRkTRW8ExuqKYiFz_ibLEvjFADo)

1. proj库函数，使用地理编码器，优点：精度高，缺点：计算效率相对低，需要引入第三方库




# 4 特性设计



## 4.1 总体方案

该章节主要描述该特性的详细设计，包括什么算法，处理流程，模块依赖关系等。

各特性根据实际情况参考下述设计方法进行设计，不要求严格一致，比如存储更关注并发、性能、故障，SQL更关注语法、功能、性能。



### 4.1.1 特性功能设计



涉及代码修改代码仓：

1. yasdb-plugin仓库，gis模块新增函数st_distance_sphere实现3.6.1公式计算，为与doris精度对齐，计算步骤和数据类型与doris计算函数完全一致。增加yspiDstbInitialize函数供anchorbase在分布式部署下调用，该函数仅放开ST_Distance_Sphere
1. anchorbase 仓，引入plugin仓对应处理函数，配套修改ext目录下的代码，使列存支持ST_Distance_Sphere函数的执行




- 引入load plugin动态库处理函数：  **loadPackageEntity**
- gPluginMethods中新增ST_DISTANCE_SPHERE函数定义


```
CodResult pifConcludeDistanceSphere(AnlStmt* stmt, ExprNode* node, TypeDesc* retType)
{
    retType->type = DTYPE_DOUBLE;
    retType->size = TYPE_SIZE(retType->type);
    return COD_SUCCESS;
}

PluginMethod gPluginMethods[] = {
    {.name = COD_TEXT_DEF("REGEXP_COUNT"), .conclude = pifConcludeRegExpCount },
    {.name = COD_TEXT_DEF("REGEXP_INSTR"), .conclude = pifConcludeRegExpInStr },
    {.name = COD_TEXT_DEF("REGEXP_LIKE"), .conclude = pifConcludeRegExpLike },
    {.name = COD_TEXT_DEF("REGEXP_REPLACE"), .conclude = pifConcludeRegExpReplace },
    {.name = COD_TEXT_DEF("REGEXP_SUBSTR"), .conclude = pifConcludeRegExpSubStr },
    {.name = COD_TEXT_DEF("RLIKE_FILTER"), .conclude = pifConcludeRlikeFilter },
    {.name = COD_TEXT_DEF("ST_DISTANCE_SPHERE"), .conclude = pifConcludeDistanceSphere },
};
```

- 将anl_plugin.h下的EnPluginFuncId定义移到anl_def.h中，并新增一个PIF_DISTANCE_SPHERE成员。


```
typedef enum EnPluginFuncId {
    PIF_REGEXP_COUNT,
    PIF_REGEXP_INSTR,
    PIF_REGEXP_LIKE,
    PIF_REGEXP_REPLACE,
    PIF_REGEXP_SUBSTR,
    PIF_RLIKE_FILTER,
    PIF_DISTANCE_SPHERE,
    __PIF_COUNT__
} PluginFuncId;
```

- build.rs的allowlist_types增加PluginFuncId项
- ext/anchor-rs/src/plsql/expression.rs中新增PluginFuncId枚举


```
#[derive(Debug, PartialEq)]
#[repr(u32)]
pub enum PluginFuncId {
    Invalid = EnPluginFuncId___PIF_COUNT__ as u32,
    Distance = EnPluginFuncId_PIF_DISTANCE_SPHERE,
}

impl From<u32> for PluginFuncId {
    #![allow(non_upper_case_globals)]
    fn from(plugin_func_id: u32) -> Self {
        match plugin_func_id as EnPluginFuncId {
            EnPluginFuncId_PIF_DISTANCE_SPHERE => PluginFuncId::DistanceSphere,
            _ => PluginFuncId::Invalid,
        }
    }
}
```

- ext/anchor-rs/src/plsql/expression.rs给Function结构体新增成员函数来获取plugin函数的id


```
impl Function {
····
    #[inline]
    pub fn plugin_func_id(&self) -> PluginFuncId {
        unsafe {
            if !self.is_plugin() {
                return PluginFuncId::Invalid;
            }
            PluginFuncId::from(
                self.node
                    .inner
                    .value
                    .__bindgen_anon_1
                    .vFunc
                    .__bindgen_anon_2
                    .pif
                    .id as u32,
            )
        }
    }
 ····
}
```

- ext/transform/src/expression新增distance_sphere.rs文件，存放st_distance_sphere表达式（需要补充ut用例看护）。
- 该文件实现StDistanceSphere的各个trait函数，evaluate过程中各个计算步骤和每个数据类型与yasdb-plugins的函数实现完全一致，实现行列对齐


```
// Copyright 2024 CoD Team. All Rights Reserved.

//! st_distance_sphere expression.

use alloc_safe::{try_format, TryToString};
use crab::alloc::{CodBox, StdAlloc};
use crab::bitmap::OptionBitmapOp;
use crab::buffer::Allocator;
use crab::column::{column_builder, ColumnRef, FixedLenBuilder, Float64Column, TypedColumn};
use crab::column_set::ColumnSet;
use crab::context::Context;
use crab::error::{Error, Result as CrabResult};
use crab::expression::{BoundExpr, BoxedExpr, CodBoundExpr, Expression};
use crab::schema::Schema;
use crab::types::{DataType, Float64Type};
use crab::util::clone::TryClone;
use crab::util::collection::CodVec;
use std::any::Any;
use std::f64::consts::{FRAC_PI_2, PI};
use std::sync::Arc;

/// `DistanceSphere` expression.
#[derive(Debug, PartialEq)]
pub struct StDistanceSphere {
    args: CodVec<BoxedExpr>,
}

impl StDistanceSphere {
    /// Creates a `StDistanceSphere` expression.
    #[inline]
    pub fn try_new(args: CodVec<BoxedExpr>) -> CrabResult<Self> {
        if args.len() != 4 {
            return Err(Error::InvalidArgument(
                "invalid argument number for st_distance_sphere".try_to_string()?,
            ));
        }
        Ok(Self { args })
    }
}

impl TryClone for StDistanceSphere {
    #[inline]
    fn try_clone(&self) -> CrabResult<Self> {
        Ok(Self {
            args: self.args.try_clone()?,
        })
    }
}

impl Expression for StDistanceSphere {
    #[inline]
    fn name(&self) -> &str {
        "st_distance_sphere"
    }

    #[inline]
    fn as_any(&self) -> &dyn Any {
        self
    }

    #[inline]
    fn schema_name(&self, schema: &Schema) -> CrabResult<String> {
        Ok(try_format!(
            "st_distance_sphere({}, {}, {}, {})",
            self.args[0].schema_name(schema)?,
            self.args[1].schema_name(schema)?,
            self.args[2].schema_name(schema)?,
            self.args[3].schema_name(schema)?,
        )?)
    }

    #[inline]
    fn data_type(&self, _schema: &Schema) -> CrabResult<DataType> {
        Ok(DataType::Float64)
    }

    #[inline]
    fn bind(&self, ctx: &Arc<dyn Context>, schema: &Schema) -> CrabResult<CodBoundExpr> {
        let bound_expr1 = self.args[0].bind(ctx, schema)?;
        let bound_expr2 = self.args[1].bind(ctx, schema)?;
        let bound_expr3 = self.args[2].bind(ctx, schema)?;
        let bound_expr4 = self.args[3].bind(ctx, schema)?;

        let bound_expr = BoundStDistanceSphere::try_new(
            ctx.alloc().clone(),
            bound_expr1,
            bound_expr2,
            bound_expr3,
            bound_expr4,
        )?;
        Ok(bound_expr)
    }

    #[inline]
    fn nullable(&self) -> bool {
        false
    }
}

struct BoundStDistanceSphere {
    alloc: Arc<dyn Allocator>,
    arg1: CodBoundExpr,
    arg2: CodBoundExpr,
    arg3: CodBoundExpr,
    arg4: CodBoundExpr,
}

impl BoundStDistanceSphere {
    #[inline]
    fn try_new(
        alloc: Arc<dyn Allocator>,
        arg1: CodBoundExpr,
        arg2: CodBoundExpr,
        arg3: CodBoundExpr,
        arg4: CodBoundExpr,
    ) -> CrabResult<CodBoundExpr> {
        Ok(CodBox::try_new_in(
            Self {
                alloc: alloc.clone(),
                arg1,
                arg2,
                arg3,
                arg4,
            },
            StdAlloc::try_new(&alloc)?,
        )?)
    }
}

impl BoundExpr for BoundStDistanceSphere {
    #[inline]
    fn name(&self) -> &str {
        "st_distance_sphere"
    }

    #[inline]
    fn data_type(&self) -> DataType {
        DataType::Float64
    }

    #[inline]
    fn evaluate(&mut self, column_set: &ColumnSet) -> CrabResult<ColumnRef> {
        let lon1 = self.arg1.evaluate(column_set)?;
        let lat1 = self.arg2.evaluate(column_set)?;
        let lon2 = self.arg3.evaluate(column_set)?;
        let lat2 = self.arg4.evaluate(column_set)?;
        let bitmap = column_set
            .invalid_bitmap()
            .bit_and(lon1.null_bitmap(), &self.alloc)?
            .bit_and(lat1.null_bitmap(), &self.alloc)?
            .bit_and(lon2.null_bitmap(), &self.alloc)?
            .bit_and(lat2.null_bitmap(), &self.alloc)?;
        let lon1_col = lon1.downcast_ref::<Float64Column>()?;
        let lat1_col = lat1.downcast_ref::<Float64Column>()?;
        let lon2_col = lon2.downcast_ref::<Float64Column>()?;
        let lat2_col = lat2.downcast_ref::<Float64Column>()?;
        let mut builder = column_builder(Float64Type, &self.alloc, column_set.row_count())?;

        match bitmap {
            None => {
                for (lon1, (lat1, (lon2, lat2))) in lon1_col.value_non_null_iter().zip(
                    lat1_col.value_non_null_iter().zip(
                        lon2_col
                            .value_non_null_iter()
                            .zip(lat2_col.value_non_null_iter()),
                    ),
                ) {
                    append_res(&mut builder, lon1, lat1, lon2, lat2);
                }
            }
            Some(null_bitmap) => {
                for (id, not_null) in null_bitmap.iter().enumerate() {
                    match not_null {
                        true => {
                            let lon1 = unsafe { lon1_col.value_unchecked(id) };
                            let lat1 = unsafe { lat1_col.value_unchecked(id) };
                            let lon2 = unsafe { lon2_col.value_unchecked(id) };
                            let lat2 = unsafe { lat2_col.value_unchecked(id) };
                            append_res(&mut builder, lon1, lat1, lon2, lat2);
                        }
                        false => unsafe { builder.append_null_unchecked() },
                    }
                }
            }
        }
        Ok(Arc::try_new_in(
            builder.finish()?,
            StdAlloc::try_new(&self.alloc)?,
        )?)
    }
}

#[inline]
fn append_res(
    builder: &mut FixedLenBuilder<Float64Type>,
    lon1: f64,
    lat1: f64,
    lon2: f64,
    lat2: f64,
) {
    let (valid, distance) = cal_distance(lat1, lon1, lat2, lon2);
    if valid {
        unsafe { builder.append_value_unchecked(distance) }
    } else {
        unsafe { builder.append_null_unchecked() }
    }
}

// use Haversine formula
#[inline]
fn cal_distance(lat1_deg: f64, lon1_deg: f64, lat2_deg: f64, lon2_deg: f64) -> (bool, f64) {
    const EARTH_RADIUS_METERS: f64 = 6371010.0;

    let lat1 = deg_to_radian(lat1_deg);
    let lon1 = deg_to_radian(lon1_deg);
    let lat2 = deg_to_radian(lat2_deg);
    let lon2 = deg_to_radian(lon2_deg);
    if !is_valid(lat1, lon1) || !is_valid(lat2, lon2) {
        return (false, 0.0);
    }

    let d_lat = f64::sin(0.5 * (lat2 - lat1));
    let d_lon = f64::sin(0.5 * (lon2 - lon1));
    let x = d_lat * d_lat + d_lon * d_lon * f64::cos(lat1) * f64::cos(lat2);
    let res = 2.0 * f64::asin(f64::sqrt(x.min(1.0))) * EARTH_RADIUS_METERS;

    (true, res)
}

#[inline]
fn deg_to_radian(deg: f64) -> f64 {
    (PI / 180.0) * deg
}

#[inline]
fn is_valid(lat: f64, lon: f64) -> bool {
    lat <= FRAC_PI_2 && lon <= PI
}

```

- ext/transform/src/expression/mod.rs适配st_distance_sphere函数，在transform_func函数接口中修改：


```
transform_func(····){
  ····
        _ if func.is_udf() || func.is_plugin() => {
            if func.is_plugin() && func.plugin_func_id() == PluginFuncId::DistanceSphere {
                check_args_num("StDistanceSphere", arg_exprs.len(), 4)?;
                return Ok(try_new_box_expr(StDistanceSphere::try_new(arg_exprs)?)?);
            }
            let expr = context.plan_ctx.builder().create_general_expr(
                func.node() as *const ExprNode as usize,
                arg_exprs,
                false,
                context.charset()?,
            )?;
            Ok(expr)
        }
····
}
```



### 4.1.2 整体流程设计

建议选用数据流图、流程图或者活动图说明清楚特性处理流程，涉及多线程/多对象参与的，可增加顺序图/时序图。

存在状态机切换的，需要考虑状态转换图或者状态图。



### 4.1.3 关键数据结构设计 



### 4.1.4 外部依赖接口设计（可选）

对于有外部第三方、开源依赖的特性设计，  必须在设计中明确外部接口的调用关系。



## 4.2 安全性设计

安全威胁分析及设计，根据安全设计方法，数据流图、业务场景以及信任边界进行分析说明。具体方法有：

|分析手段|安全分析点|
|---|---|
|外部交互分析|需要关注仿冒、抵赖相关威胁分析。|
|数据流分析|需要关注篡改、信息泄露、拒绝服务分析。|
|处理过程分析|需要关注仿冒、篡改、抵赖、拒绝服务、权限提升分析。|
|数据存储分析|需要关注篡改、抵赖、信息泄露、决绝服务分析。|




## 4.3 其他DFX相关设计

基于前面的特性影响分析或概要设计中的DFX分析，结合当前特性的实现方案进行对应维度的DFX设计。

如可靠/可用性、可测试性、可服务性、可演进性、兼容性、可伸缩性/可扩展性，可用性，性能等。



# 5 资料设计

资料在设计阶段，要识别出来相关需要调整的范围、大纲。

内置函数-GIS Function中需要新增ST_DISTANCE_SPHERE函数文档



# 6 自测用例设计



- 自测用例设计方法：边界值、等价类、正交等。
    - 分布式下测试tac+lsc表，单机下测试heap+tac+lsc表
    - 入参是两相同坐标/不同坐标
    - 入参含null/无null
    - 入参是规格边界值/超过边界值/边界值内/正数/负数/0
    - 入参是整数/小数
    - 入参是两个极相近/极远的点
    - 入参是常量/变量/计算表达式
    - 入参是合法/非法类型，覆盖所有数据类型
    - 函数多层嵌套计算
    - 开启/不开启并行计算




# 7 参考资料清单

当前特性设计参考了哪些输入、哪些调研材料，包括特性相关的历史文档链接。

设计工具图参考：  [(584) 设计工具图类参考 | 知识管理 - PingCode](https://pingcode.yasdb.com/wiki/spaces/CODPUBLIC/pages/673976a6728206efb92f6922)  

