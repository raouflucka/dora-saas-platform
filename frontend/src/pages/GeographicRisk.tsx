import { useQuery } from '@tanstack/react-query';
import { riskApi } from '../api/risk';
import { Globe2, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';

export default function GeographicRisk() {
  const { data: geoRisk, isLoading } = useQuery({ 
    queryKey: ['geographic-risk'], 
    queryFn: riskApi.getGeographic 
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <Globe2 className="w-6 h-6 text-teal-400" /> Geographic Exposure
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Analysis of ICT risk based on the primary country of provision (DORA Art. 29).
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-teal-500" />
        </div>
      ) : (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-semibold text-white">Geographic Distribution</h2>
            <span className="text-sm text-zinc-400">Total contracts: {geoRisk?.totalContracts ?? 0}</span>
          </div>

          {(geoRisk?.highRiskCountries ?? 0) > 0 && (
            <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg flex gap-3 mb-6">
              <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-amber-400">High Concentration Detected</p>
                <p className="text-sm text-amber-300/80 mt-1">
                  {geoRisk!.highRiskCountries} countr(ies) process ≥40% of your ICT services. Consider diversifying provider locations to reduce geographic risk.
                </p>
              </div>
            </div>
          )}

          <div className="overflow-hidden rounded-xl border border-zinc-800">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-zinc-900/80 border-b border-zinc-800">
                  <th className="px-6 py-4 text-left font-semibold text-zinc-400">Country</th>
                  <th className="px-6 py-4 text-left font-semibold text-zinc-400">Contracts</th>
                  <th className="px-6 py-4 text-left font-semibold text-zinc-400">Share</th>
                  <th className="px-6 py-4 text-left font-semibold text-zinc-400">Risk Level</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/50">
                {(geoRisk?.riskItems?.length ?? 0) === 0 ? (
                   <tr>
                     <td colSpan={4} className="px-6 py-12 text-center text-zinc-500 flex flex-col items-center gap-2">
                       <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                       No geographic concentration risks found. Add contracts to see data.
                     </td>
                   </tr>
                ) : (
                  geoRisk?.riskItems?.map(item => (
                    <tr key={item.countryCode} className="hover:bg-zinc-900/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-medium text-zinc-200">{item.countryName}</div>
                        <div className="text-xs text-zinc-500 font-mono mt-0.5">{item.countryCode}</div>
                      </td>
                      <td className="px-6 py-4 text-zinc-300">
                        {item.contractCount} contract(s)
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex-1 bg-zinc-800 rounded-full h-2 max-w-[120px]">
                            <div 
                              className={`h-2 rounded-full ${
                                item.riskLevel === 'HIGH' ? 'bg-red-500' :
                                item.riskLevel === 'MEDIUM' ? 'bg-amber-500' :
                                'bg-teal-500'
                              }`} 
                              style={{ width: `${Math.min(item.percentageShare, 100)}%` }} 
                            />
                          </div>
                          <span className="text-sm font-medium text-white">{item.percentageShare}%</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`text-[10px] px-2 py-1 rounded-md font-bold uppercase ${
                          item.riskLevel === 'HIGH' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                          item.riskLevel === 'MEDIUM' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                          'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        }`}>
                          {item.riskLevel} RISK
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
